import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { signSnoozeToken } from "@/lib/snooze-token";
import ReminderEmail, { type StaleLead } from "@/emails/ReminderEmail";

export async function GET(req: Request) {
  // Authenticate — only Vercel Cron (or manual calls with the secret) allowed
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // Fetch stale leads from the view
  const { data: staleLeads, error } = await supabase
    .from("stale_leads")
    .select("*");

  if (error) {
    console.error("Failed to fetch stale leads:", error);
    return Response.json({ error: "Failed to fetch stale leads" }, { status: 500 });
  }

  if (!staleLeads?.length) {
    return Response.json({ sent: 0, total: 0 });
  }

  // Group stale leads by owner_id to batch-fetch emails
  const ownerIds = [...new Set(staleLeads.map((l) => l.owner_id as string))];

  // Fetch owner emails from auth.users using admin API
  const ownerEmails: Record<string, string> = {};
  for (const ownerId of ownerIds) {
    const { data: userData } = await supabase.auth.admin.getUserById(ownerId);
    if (userData?.user?.email) {
      ownerEmails[ownerId] = userData.user.email;
    }
  }

  let sent = 0;
  for (const lead of staleLeads) {
    const ownerEmail = ownerEmails[lead.owner_id as string];
    if (!ownerEmail) continue;

    const staleLead: StaleLead = {
      id: lead.id as string,
      name: lead.name as string,
      company: lead.company as string | null,
      stage_name: lead.stage_name as string,
      sla_days: lead.sla_days as number,
      last_activity_at: lead.last_activity_at as string,
      due_at: lead.due_at as string,
      notes: lead.notes as string | null,
    };

    const snoozeToken = signSnoozeToken(staleLead.id);
    const snoozeUrl = `${appUrl}/snooze/${staleLead.id}?token=${snoozeToken}`;

    try {
      const { data: emailResult } = await resend.emails.send({
        from: "LeadTracker <reminders@leadtracker.elivate.io>",
        to: ownerEmail,
        subject: `Follow up: ${staleLead.name}${staleLead.company ? ` (${staleLead.company})` : ""}`,
        react: ReminderEmail({ lead: staleLead, appUrl, snoozeUrl }),
      });

      // Mark reminder as sent on the lead
      await supabase
        .from("leads")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", staleLead.id);

      // Audit log in reminders table
      await supabase.from("reminders").insert({
        workspace_id: lead.workspace_id as string,
        lead_id: staleLead.id,
        due_at: staleLead.due_at,
        email_id: emailResult?.id ?? null,
        status: "sent",
      });

      // Activity log
      await supabase.from("activities").insert({
        workspace_id: lead.workspace_id as string,
        lead_id: staleLead.id,
        type: "reminder_sent",
        payload: { due_at: staleLead.due_at },
      });

      sent++;
    } catch (err) {
      console.error(`Reminder failed for lead ${staleLead.id}:`, err);

      // Log failure in reminders table
      await supabase.from("reminders").insert({
        workspace_id: lead.workspace_id as string,
        lead_id: staleLead.id,
        due_at: staleLead.due_at,
        email_id: null,
        status: "failed",
      });
    }
  }

  return Response.json({ sent, total: staleLeads.length });
}
