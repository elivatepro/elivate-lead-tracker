import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/admin";
import { runWithConcurrency } from "@/lib/concurrency";
import { splitContactValues } from "@/lib/contacts";
import { decryptSecret } from "@/lib/email/encrypt";
import { hasEmailSettings, type EmailWorkspaceSettings } from "@/lib/email/smtp";
import { buildFooter, htmlToText, injectFooterHtml } from "@/lib/email/footer";
import { classifySmtpError } from "@/lib/email/smtp-errors";
import { createPooledTransport, sendMessage } from "@/lib/email/transport";
import { signUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import type { Database } from "@/lib/types/database";

type Admin = SupabaseClient;
type QueueRow = Database["public"]["Tables"]["email_queue"]["Row"];
type LeadRow = { id: string; email: string | null; archived_at: string | null };
type Outcome = "sent" | "failed" | "skipped" | "retry" | "release";

type WorkspaceRow = EmailWorkspaceSettings & {
  id: string;
  email_footer_address: string | null;
  email_reply_to: string | null;
};

export type QueueSummary = {
  workspaces: number;
  claimed: number;
  sent: number;
  failed: number;
  skipped: number;
  retried: number;
  released: number;
};

const RUN_BUDGET_MS = 50_000;
const STALE_CLAIM_MS = 15 * 60_000;
const AUTH_BACKOFF_SECONDS = 15 * 60;
const RETRY_BASE_SECONDS = 5 * 60;
const WORKSPACE_CONCURRENCY = 4;

async function finalize(
  db: Admin,
  id: string,
  outcome: Outcome,
  error: string | null = null,
  messageId: string | null = null,
  retrySeconds = RETRY_BASE_SECONDS
): Promise<string> {
  const { data, error: rpcError } = await db.rpc("email_queue_finalize", {
    p_id: id,
    p_outcome: outcome,
    p_error: error,
    p_message_id: messageId,
    p_retry_seconds: retrySeconds,
  });
  if (rpcError) {
    // The row stays in 'sending' and is failed by recoverStaleClaims().
    console.error(`email_queue_finalize failed for ${id} (${outcome}):`, rpcError.message);
    return "error";
  }
  return (data as string | null) ?? "noop";
}

// A worker that died mid-send leaves rows in 'sending'. We can't know whether
// the message went out, so fail them rather than risk a duplicate.
async function recoverStaleClaims(db: Admin): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const { data } = await db
    .from("email_queue")
    .select("id")
    .eq("status", "sending")
    .lt("claimed_at", cutoff)
    .limit(200);

  for (const row of (data ?? []) as { id: string }[]) {
    await finalize(
      db,
      row.id,
      "failed",
      "Send outcome unknown (worker timed out); not retried to avoid a duplicate"
    );
  }
}

async function processWorkspace(
  db: Admin,
  ws: WorkspaceRow,
  appUrl: string,
  deadline: number,
  summary: QueueSummary
): Promise<void> {
  const limit = ws.email_batch_size || 10;

  const { data: claimed, error: claimError } = await db.rpc("claim_email_queue", {
    p_workspace_id: ws.id,
    p_limit: limit,
  });
  if (claimError) {
    console.error(`claim_email_queue failed for ${ws.id}:`, claimError.message);
    return;
  }
  const rows = (claimed ?? []) as QueueRow[];
  if (rows.length === 0) return;
  summary.claimed += rows.length;

  if (!hasEmailSettings(ws)) {
    for (const row of rows) {
      await finalize(db, row.id, "failed", "SMTP is not configured for this workspace");
      summary.failed++;
    }
    return;
  }

  let pass: string;
  try {
    pass = decryptSecret(ws.smtp_pass_encrypted ?? "");
  } catch (err) {
    console.error(`Can't decrypt SMTP password for ${ws.id}:`, err);
    for (const row of rows) {
      await finalize(db, row.id, "release", "Saved SMTP password can't be decrypted", null, AUTH_BACKOFF_SECONDS);
      summary.released++;
    }
    return;
  }

  const recipients = [...new Set(rows.map((r) => r.to_email.trim().toLowerCase()))];
  const leadIds = [...new Set(rows.map((r) => r.lead_id))];
  const [suppressionsRes, leadsRes] = await Promise.all([
    db.from("email_suppressions").select("email").eq("workspace_id", ws.id).in("email", recipients),
    db.from("leads").select("id, email, archived_at").eq("workspace_id", ws.id).in("id", leadIds),
  ]);
  const suppressed = new Set(((suppressionsRes.data ?? []) as { email: string }[]).map((r) => r.email));
  const leadById = new Map(((leadsRes.data ?? []) as LeadRow[]).map((l) => [l.id, l]));

  const transporter = createPooledTransport({
    host: ws.smtp_host ?? "",
    port: ws.smtp_port || 587,
    user: ws.smtp_user ?? "",
    pass,
  });
  const fromName = ws.email_from_name || "LeadTracker";
  let authFailed = false;

  async function handleRow(row: QueueRow): Promise<void> {
    if (authFailed || Date.now() > deadline) {
      await finalize(
        db,
        row.id,
        "release",
        authFailed ? "SMTP login was rejected" : null,
        null,
        authFailed ? AUTH_BACKOFF_SECONDS : 0
      );
      summary.released++;
      return;
    }

    const to = row.to_email.trim().toLowerCase();
    const lead = leadById.get(row.lead_id);

    let skipReason: string | null = null;
    if (!lead || lead.archived_at) skipReason = "Lead was archived";
    else if (suppressed.has(to)) skipReason = "Recipient suppressed";
    else if (!splitContactValues(lead.email).some((e) => e.toLowerCase() === to)) {
      skipReason = "Address was removed from the lead";
    }
    if (skipReason) {
      await finalize(db, row.id, "skipped", skipReason);
      summary.skipped++;
      return;
    }

    if (!row.body_html || !row.body_html.trimStart().startsWith("<")) {
      await finalize(db, row.id, "failed", "Queued message has no body");
      summary.failed++;
      return;
    }

    const token = signUnsubscribeToken(ws.id, to);
    const footer = buildFooter({
      unsubscribeUrl: `${appUrl}/unsubscribe/${token}`,
      address: ws.email_footer_address,
    });
    const senderDomain = row.from_email.split("@")[1] ?? "leadtracker.local";

    let messageId: string;
    try {
      ({ messageId } = await sendMessage(transporter, {
        from: { name: fromName, address: row.from_email },
        to: row.to_email.trim(),
        subject: row.subject,
        html: injectFooterHtml(row.body_html, footer.html),
        text: (row.body_text ?? htmlToText(row.body_html)) + footer.text,
        replyTo: ws.email_reply_to ?? undefined,
        unsubscribeUrl: `${appUrl}/api/unsubscribe?t=${token}`,
        messageId: `<${row.id}@${senderDomain}>`,
      }));
    } catch (err) {
      const failure = classifySmtpError(err);
      console.error(`Send failed for queue ${row.id} (${failure.kind}):`, failure.message);

      if (failure.kind === "auth") {
        authFailed = true;
        await finalize(db, row.id, "release", failure.message, null, AUTH_BACKOFF_SECONDS);
        summary.released++;
      } else if (failure.kind === "retryable") {
        const result = await finalize(
          db,
          row.id,
          "retry",
          failure.message,
          null,
          RETRY_BASE_SECONDS * 3 ** Math.max(row.attempts - 1, 0)
        );
        if (result === "retried") summary.retried++;
        else summary.failed++;
      } else {
        await finalize(db, row.id, "failed", failure.message);
        summary.failed++;
        if (failure.kind === "bounce") {
          await db.rpc("suppress_email", {
            p_workspace_id: ws.id,
            p_email: to,
            p_reason: "bounce",
          });
        }
      }
      return;
    }

    // The message is out. Nothing below may throw into the release path, or
    // the row would be re-queued and sent a second time.
    summary.sent++;
    try {
      await finalize(db, row.id, "sent", null, messageId);
    } catch (err) {
      console.error(`finalize threw after a successful send for ${row.id}:`, err);
    }
  }

  try {
    for (const row of rows) {
      try {
        await handleRow(row);
      } catch (err) {
        // Anything unexpected before a send was attempted: put the row back
        // rather than leaving it claimed until stale recovery fails it.
        console.error(`Unexpected error handling queue ${row.id}:`, err);
        await finalize(db, row.id, "release", "Unexpected error before sending", null, 60);
        summary.released++;
      }
    }
  } finally {
    transporter.close();
  }
}

export async function processEmailQueue(): Promise<QueueSummary> {
  const deadline = Date.now() + RUN_BUDGET_MS;
  const summary: QueueSummary = {
    workspaces: 0,
    claimed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    retried: 0,
    released: 0,
  };

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is not set");
  // Throws UnsubscribeConfigError before anything is claimed if the secret is missing.
  signUnsubscribeToken("00000000-0000-0000-0000-000000000000", "config-check@example.com");

  const db = createServiceClient();
  await recoverStaleClaims(db);

  const { data: due } = await db
    .from("email_queue")
    .select("workspace_id")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(500);

  const workspaceIds = [...new Set(((due ?? []) as { workspace_id: string }[]).map((r) => r.workspace_id))];
  if (workspaceIds.length === 0) return summary;

  const { data: workspaces, error } = await db
    .from("workspaces")
    .select(
      "id, smtp_host, smtp_port, smtp_user, smtp_pass_encrypted, email_from_name, email_signature, email_batch_size, email_batch_delay, email_footer_address, email_reply_to"
    )
    .in("id", workspaceIds);
  if (error) throw new Error(`Failed to load workspaces: ${error.message}`);

  summary.workspaces = workspaces?.length ?? 0;

  await runWithConcurrency((workspaces ?? []) as WorkspaceRow[], WORKSPACE_CONCURRENCY, async (ws) => {
    try {
      await processWorkspace(db, ws, appUrl, deadline, summary);
    } catch (err) {
      console.error(`Queue processing failed for workspace ${ws.id}:`, err);
    }
  });

  return summary;
}
