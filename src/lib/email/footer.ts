function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Per-recipient footer: unsubscribe link plus the sender's postal address.
// Added at send time because the link is unique to each recipient.
export function buildFooter({
  unsubscribeUrl,
  address,
}: {
  unsubscribeUrl: string;
  address?: string | null;
}): { html: string; text: string } {
  const addressLines = (address ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const addressHtml = addressLines.length
    ? `${addressLines.map(escapeHtml).join("<br/>")}<br/>`
    : "";

  const html =
    `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e8e2d4;` +
    `font-family:Onest,-apple-system,sans-serif;font-size:12px;line-height:1.6;color:#8a8375;">` +
    addressHtml +
    `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#8a8375;text-decoration:underline;">Unsubscribe</a>` +
    ` from these emails.</div>`;

  const text =
    `\n--\n` +
    (addressLines.length ? `${addressLines.join("\n")}\n` : "") +
    `Unsubscribe: ${unsubscribeUrl}\n`;

  return { html, text };
}

export function injectFooterHtml(html: string, footerHtml: string): string {
  const idx = html.toLowerCase().lastIndexOf("</body>");
  if (idx === -1) return html + footerHtml;
  return html.slice(0, idx) + footerHtml + html.slice(idx);
}

// Fallback plain-text part for rows queued without one.
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
