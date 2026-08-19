import nodemailer from "nodemailer";

export type EmailWorkspaceSettings = {
  smtp_host: string | null;
  smtp_port: number;
  smtp_user: string | null;
  smtp_pass_encrypted: string | null;
  email_from_name: string | null;
  email_signature: string | null;
  email_batch_size: number;
  email_batch_delay: number;
};

export function hasEmailSettings(settings: EmailWorkspaceSettings): boolean {
  return Boolean(
    settings.smtp_host && settings.smtp_user && settings.smtp_pass_encrypted
  );
}

type SendArgs = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  html?: string;
};

export async function sendEmail({
  host,
  port,
  user,
  pass,
  from,
  to,
  subject,
  html,
}: SendArgs): Promise<void> {
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    subject,
    html,
  });
}

export function describeSmtpError(
  err: unknown,
  { host, port }: { host: string; port: number }
): string {
  const message = err instanceof Error ? err.message : String(err);

  if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH/.test(message)) {
    return `Couldn't reach ${host}:${port} (${message}). Check the host and port — for Gmail use smtp.gmail.com with port 587 (STARTTLS) or 465 (SSL).`;
  }

  if (/invalid login|535|EAUTH|authentication failed|login failed|username and password/i.test(message)) {
    return `Login to ${host} rejected (${message}). For Gmail, create an App Password at myaccount.google.com/apppasswords and use that — not your normal password.`;
  }

  return `${message} (${host}:${port})`;
}