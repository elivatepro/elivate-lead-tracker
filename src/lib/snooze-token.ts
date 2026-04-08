import { createHmac } from "crypto";

const SECRET = () => process.env.SNOOZE_TOKEN_SECRET!;
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function signSnoozeToken(leadId: string): string {
  const expires = Date.now() + EXPIRY_MS;
  const payload = `${leadId}.${expires}`;
  const sig = createHmac("sha256", SECRET()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifySnoozeToken(
  token: string
): { leadId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const [leadId, expiresStr, sig] = decoded.split(".");
    if (!leadId || !expiresStr || !sig) return null;

    const payload = `${leadId}.${expiresStr}`;
    const expected = createHmac("sha256", SECRET()).update(payload).digest("hex");

    if (sig !== expected) return null;
    if (Date.now() > Number(expiresStr)) return null;

    return { leadId };
  } catch {
    return null;
  }
}
