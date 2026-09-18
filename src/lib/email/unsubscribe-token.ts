import { createHmac, timingSafeEqual } from "crypto";

// Token format: v1.<workspaceId>.<base64url(email)>.<base64url(hmac)>
// Non-expiring on purpose (an unsubscribe link in an old email must keep
// working) and bound to a purpose string so it can't be replayed as any other
// kind of token. Uses its own secret, never the snooze token secret.

const MIN_SECRET_LENGTH = 32;

export class UnsubscribeConfigError extends Error {
  constructor() {
    super("UNSUBSCRIBE_TOKEN_SECRET is missing or too short (need 32+ characters)");
    this.name = "UnsubscribeConfigError";
  }
}

function secret(): string {
  const value = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  if (!value || value.length < MIN_SECRET_LENGTH) throw new UnsubscribeConfigError();
  return value;
}

function mac(workspaceId: string, email: string): Buffer {
  return createHmac("sha256", secret())
    .update(`unsub|v1|${workspaceId}|${email}`)
    .digest();
}

export function signUnsubscribeToken(workspaceId: string, email: string): string {
  const normalized = email.trim().toLowerCase();
  return [
    "v1",
    workspaceId,
    Buffer.from(normalized).toString("base64url"),
    mac(workspaceId, normalized).toString("base64url"),
  ].join(".");
}

export function verifyUnsubscribeToken(
  token: string
): { workspaceId: string; email: string } | null {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;

  const [, workspaceId, emailPart, macPart] = parts;
  if (!workspaceId || !emailPart || !macPart) return null;

  let email: string;
  try {
    email = Buffer.from(emailPart, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!email || email !== email.trim().toLowerCase()) return null;

  const provided = Buffer.from(macPart, "base64url");
  const expected = mac(workspaceId, email);
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  return { workspaceId, email };
}
