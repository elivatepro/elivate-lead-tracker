import nodemailer, { type Transporter } from "nodemailer";
import type SMTPPool from "nodemailer/lib/smtp-pool";

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
};

export type OutgoingMessage = {
  from: { name: string; address: string };
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  unsubscribeUrl: string;
  messageId: string;
};

// One pooled connection per workspace per run, with hard timeouts so a
// hanging SMTP server can't eat the whole function budget.
export function createPooledTransport({ host, port, user, pass }: SmtpConfig): Transporter {
  const options: SMTPPool.Options = {
    pool: true,
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    maxConnections: 1,
    maxMessages: 100,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    auth: { user, pass },
  };
  return nodemailer.createTransport(options);
}

export async function sendMessage(
  transporter: Transporter,
  message: OutgoingMessage
): Promise<{ messageId: string }> {
  const info = await transporter.sendMail({
    from: message.from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    replyTo: message.replyTo,
    messageId: message.messageId,
    list: { unsubscribe: { url: message.unsubscribeUrl, comment: "Unsubscribe" } },
    headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
  return { messageId: info.messageId ?? message.messageId };
}
