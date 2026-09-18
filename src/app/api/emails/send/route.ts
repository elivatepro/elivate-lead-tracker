import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext } from "@/lib/supabase/queries";
import { hasEmailSettings, type EmailWorkspaceSettings } from "@/lib/email/smtp";
import { buildEmailHtml, buildEmailText } from "@/lib/email/render";
import { isValidEmail, normalizeEmail, validRecipients } from "@/lib/email/recipients";

const MAX_BULK = 200;
const INSERT_CHUNK = 500;

const bodySchema = z.object({
  leadIds: z
    .array(z.string().uuid())
    .min(1, "No leads selected")
    .max(MAX_BULK, `Too many leads (max ${MAX_BULK} per send)`),
  subject: z.string().trim().min(1, "Subject and message are required").max(200),
  body: z.string().trim().min(1, "Subject and message are required").max(20_000),
});

// POST /api/emails/send — enqueue outbound emails for one or more leads
export async function POST(req: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const { leadIds, body } = parsed.data;
  // Subjects with line breaks are a header-injection vector.
  const subject = parsed.data.subject.replace(/[\r\n]+/g, " ");

  const settings = await ctx.supabase
    .from("workspaces")
    .select(
      "smtp_host, smtp_port, smtp_user, smtp_pass_encrypted, email_from_name, email_signature, email_batch_size, email_batch_delay, email_footer_address"
    )
    .eq("id", ctx.workspace.id)
    .single();

  const emailSettings = settings.data as
    | (EmailWorkspaceSettings & { email_footer_address: string | null })
    | null;
  if (!emailSettings || !hasEmailSettings(emailSettings)) {
    return NextResponse.json(
      { error: "SMTP email is not configured yet. Set it up in Settings → Email." },
      { status: 400 }
    );
  }

  const fromEmail = (emailSettings.smtp_user ?? "").trim();
  if (!isValidEmail(fromEmail)) {
    return NextResponse.json(
      {
        error:
          "Your SMTP username isn't an email address, so it can't be used as the sender. Use your full email address as the username in Settings → Email.",
      },
      { status: 400 }
    );
  }

  const { data: leads, error } = await ctx.supabase
    .from("leads")
    .select("id, email, archived_at")
    .in("id", leadIds)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const candidates = ((leads ?? []) as { id: string; email: string | null; archived_at: string | null }[])
    .filter((lead) => !lead.archived_at)
    .map((lead) => ({ id: lead.id, addresses: validRecipients(lead.email) }));

  const allAddresses = [...new Set(candidates.flatMap((c) => c.addresses.map(normalizeEmail)))];
  const suppressedSet = new Set<string>();
  if (allAddresses.length > 0) {
    const { data: suppressions } = await ctx.supabase
      .from("email_suppressions")
      .select("email")
      .eq("workspace_id", ctx.workspace.id)
      .in("email", allAddresses);
    for (const row of (suppressions ?? []) as { email: string }[]) suppressedSet.add(row.email);
  }

  const html = await buildEmailHtml(body, emailSettings.email_signature);
  const text = buildEmailText(body, emailSettings.email_signature);
  const fromName = emailSettings.email_from_name || (ctx.user.email ?? "LeadTracker");
  const delayMinutes = emailSettings.email_batch_delay || 5;

  const seen = new Set<string>();
  let suppressed = 0;
  let duplicates = 0;
  let skippedLeads = leadIds.length - candidates.length;
  let slot = 0;
  const rows: Record<string, unknown>[] = [];

  for (const lead of candidates) {
    const fresh: string[] = [];
    for (const address of lead.addresses) {
      const key = normalizeEmail(address);
      if (suppressedSet.has(key)) {
        suppressed++;
      } else if (seen.has(key)) {
        duplicates++;
      } else {
        seen.add(key);
        fresh.push(address);
      }
    }

    if (fresh.length === 0) {
      skippedLeads++;
      continue;
    }

    const scheduledFor = new Date(Date.now() + slot * delayMinutes * 60_000).toISOString();
    slot++;

    for (const address of fresh) {
      rows.push({
        workspace_id: ctx.workspace.id,
        lead_id: lead.id,
        from_email: fromEmail,
        from_name: fromName,
        to_email: address,
        subject,
        body_html: html,
        body_text: text,
        scheduled_for: scheduledFor,
        source: "manual",
      });
    }
  }

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const { error: insertError } = await ctx.supabase
      .from("email_queue")
      .insert(rows.slice(i, i + INSERT_CHUNK));
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    queued: rows.length,
    skipped: skippedLeads,
    suppressed,
    duplicates,
    warning: emailSettings.email_footer_address?.trim()
      ? undefined
      : "Add a postal address in Settings → Email. Many countries require one in commercial email.",
  });
}
