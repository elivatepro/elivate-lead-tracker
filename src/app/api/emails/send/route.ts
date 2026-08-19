import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/queries";
import { hasEmailSettings, type EmailWorkspaceSettings } from "@/lib/email/smtp";
import { buildEmailHtml } from "@/lib/email/render";

const MAX_BULK = 200;

// POST /api/emails/send — enqueue outbound emails for one or more leads
export async function POST(req: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadIds, subject, body } = await req.json();

  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: "No leads selected" }, { status: 400 });
  }
  if (leadIds.length > MAX_BULK) {
    return NextResponse.json(
      { error: `Too many leads (max ${MAX_BULK} per send)` },
      { status: 400 }
    );
  }
  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
  }

  const settings = await ctx.supabase
    .from("workspaces")
    .select(
      "smtp_host, smtp_port, smtp_user, smtp_pass_encrypted, email_from_name, email_signature, email_batch_size, email_batch_delay"
    )
    .eq("id", ctx.workspace.id)
    .single();

  const emailSettings = settings.data as EmailWorkspaceSettings | null;
  if (!emailSettings || !hasEmailSettings(emailSettings)) {
    return NextResponse.json(
      { error: "SMTP email is not configured yet. Set it up in Settings → Email." },
      { status: 400 }
    );
  }

  const { data: leads, error } = await ctx.supabase
    .from("leads")
    .select("id, name, email")
    .in("id", leadIds)
    .eq("workspace_id", ctx.workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const fromName = emailSettings.email_from_name || (ctx.user.email ?? "LeadTracker");
  const fromEmail = emailSettings.smtp_user ?? "";

  const html = buildEmailHtml(body.trim(), emailSettings.email_signature);

  let queued = 0;
  let skipped = 0;
  const delayMinutes = emailSettings.email_batch_delay || 5;

  const leadsWithEmail = (leads ?? []) as {
    id: string;
    email: string | null;
  }[];

  for (const [index, lead] of leadsWithEmail.entries()) {
    const emails = (lead.email ?? "")
      .split(",")
      .map((e: string) => e.trim())
      .filter(Boolean);

    if (emails.length === 0) {
      skipped++;
      continue;
    }

    const scheduledFor = new Date(Date.now() + index * delayMinutes * 60_000).toISOString();

    const { error: insertError } = await ctx.supabase.from("email_queue").insert(
      emails.map((toEmail) => ({
        workspace_id: ctx.workspace.id,
        lead_id: lead.id,
        from_email: fromEmail,
        from_name: fromName,
        to_email: toEmail,
        subject: subject.trim(),
        body_html: html,
        scheduled_for: scheduledFor,
      }))
    );

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    queued += emails.length;
  }

  return NextResponse.json({ queued, skipped });
}