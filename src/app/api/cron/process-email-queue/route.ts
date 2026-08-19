import { createClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/email/encrypt";
import { sendEmail, type EmailWorkspaceSettings } from "@/lib/email/smtp";

// POST /api/cron/process-email-queue — send pending queued emails in batches
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: workspaces, error: wsError } = await supabase
    .from("workspaces")
    .select(
      "id, smtp_host, smtp_port, smtp_user, smtp_pass_encrypted, email_from_name, email_batch_size, email_batch_delay"
    )
    .not("smtp_host", "is", null)
    .not("smtp_user", "is", null)
    .not("smtp_pass_encrypted", "is", null);

  if (wsError) {
    console.error("Failed to load workspaces:", wsError);
    return Response.json({ error: "Failed to load workspaces" }, { status: 500 });
  }

  let processed = 0;
  let sent = 0;
  let failed = 0;

  for (const workspace of workspaces ?? []) {
    const settings = workspace as EmailWorkspaceSettings & { id: string };

    const { data: queue } = await supabase
      .from("email_queue")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("status", "pending")
      .order("scheduled_for", { ascending: true })
      .limit(settings.email_batch_size || 10);

    for (const item of queue ?? []) {
      processed++;
      try {
        const pass = decryptSecret(settings.smtp_pass_encrypted ?? "");

        const fromName = settings.email_from_name || "LeadTracker";
        const from = `${fromName} <${item.from_email}>`;

        await sendEmail({
          host: settings.smtp_host ?? "",
          port: settings.smtp_port || 587,
          user: settings.smtp_user ?? "",
          pass,
          from,
          to: item.to_email,
          subject: item.subject,
          html: item.body_html ?? undefined,
        });

        await supabase.from("email_log").insert({
          workspace_id: item.workspace_id,
          lead_id: item.lead_id,
          to_email: item.to_email,
          subject: item.subject,
          status: "sent",
          sent_at: new Date().toISOString(),
        });

        await supabase.from("email_queue").delete().eq("id", item.id);

        await supabase.from("activities").insert({
          workspace_id: item.workspace_id,
          lead_id: item.lead_id,
          type: "email_sent",
          payload: { to: item.to_email, subject: item.subject },
        });

        await supabase
          .from("leads")
          .update({ last_activity_at: new Date().toISOString() })
          .eq("id", item.lead_id);

        sent++;
      } catch (err) {
        failed++;
        console.error(`Email send failed for queue ${item.id}:`, err);
        await supabase
          .from("email_queue")
          .update({
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
          })
          .eq("id", item.id);
      }
    }
  }

  return Response.json({ processed, sent, failed });
}