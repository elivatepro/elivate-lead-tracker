import { createHash, timingSafeEqual } from "crypto";

const MIN_SECRET_LENGTH = 16;

// Constant-time bearer check. Fails closed: a missing or short CRON_SECRET
// authorizes nothing (a plain string compare would accept "Bearer undefined").
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) return false;

  const provided = createHash("sha256")
    .update(req.headers.get("authorization") ?? "")
    .digest();
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();

  return timingSafeEqual(provided, expected);
}
