type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;

const buckets = new Map<string, number[]>();

export function takeNovRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const recent = (buckets.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

  if (recent.length >= MAX_REQUESTS) {
    const retryAfterMs = recent[0] + WINDOW_MS - now;
    buckets.set(key, recent);

    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  recent.push(now);
  buckets.set(key, recent);

  return {
    ok: true,
    remaining: Math.max(0, MAX_REQUESTS - recent.length),
    retryAfterSeconds: 0,
  };
}
