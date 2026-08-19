import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/supabase/queries";
import { decryptSecret } from "@/lib/email/encrypt";
import { describeSmtpError, sendEmail } from "@/lib/email/smtp";

type TestBody = {
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  email_from_name?: string;
  to_email?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/email-settings/test — send a test email with current form values
// (falls back to saved settings for anything not passed)
export async function POST(req: Request) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as TestBody;

  const toEmail = body.to_email?.trim() || ctx.user.email || "";
  if (!EMAIL_RE.test(toEmail)) {
    return NextResponse.json(
      { error: "Enter a valid email address to receive the test" },
      { status: 400 }
    );
  }

  const { data } = await ctx.supabase
    .from("workspaces")
    .select(
      "smtp_host, smtp_port, smtp_user, smtp_pass_encrypted, email_from_name"
    )
    .eq("id", ctx.workspace.id)
    .single();

  const host = body.smtp_host || data?.smtp_host || null;
  const port = Number(body.smtp_port ?? data?.smtp_port ?? 587);
  const user = body.smtp_user || data?.smtp_user || null;
  const fromName = body.email_from_name || data?.email_from_name || null;

  if (!host || !user) {
    return NextResponse.json(
      { error: "Enter an SMTP host and username first" },
      { status: 400 }
    );
  }

  let pass = body.smtp_password || "";
  if (!pass) {
    if (!data?.smtp_pass_encrypted) {
      return NextResponse.json(
        { error: "No password saved — enter the app password to test" },
        { status: 400 }
      );
    }
    try {
      pass = decryptSecret(data.smtp_pass_encrypted);
    } catch {
      return NextResponse.json(
        { error: "Saved password can't be decrypted (check EMAIL_ENC_KEY)" },
        { status: 500 }
      );
    }
  }

  const from = fromName ? `${fromName} <${user}>` : user;

  try {
    await sendEmail({
      host,
      port,
      user,
      pass,
      from,
      to: toEmail,
      subject: "Test email from LeadTracker",
      html:
        "<p>If you can read this, your SMTP settings are working.</p><p>— LeadTracker</p>",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: describeSmtpError(err, { host, port }) },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true });
}