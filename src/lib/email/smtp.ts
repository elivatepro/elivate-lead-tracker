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