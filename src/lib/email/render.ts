import { render } from "@react-email/components";
import EmailSignature from "@/emails/EmailSignature";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function renderSignature(text: string): Promise<string> {
  return await render(EmailSignature({ text }), {
    pretty: false,
    plainText: false,
  });
}

export async function buildEmailHtml(
  body: string,
  signature?: string | null
): Promise<string> {
  const paragraphs = body
    .split(/\r?\n\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 1.2em 0;font-size:15px;line-height:1.7;color:#3d3830;font-family:Onest,-apple-system,sans-serif;">${escapeHtml(p).replace(/\r?\n/g, "<br/>")}</p>`
    )
    .join("");

  const sig = signature?.trim() ? await renderSignature(signature) : "";

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#ffffff;">${paragraphs}${sig}</body></html>`;
}