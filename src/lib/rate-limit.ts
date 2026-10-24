// Fixed-window in-memory rate limiter. Good enough for a single instance;
// swap for Redis/Upstash when running several server instances.

type Bucket = { count: number; resetAt: number };
const g = globalThis as { __educonnectRate?: Map<string, Bucket> };
const buckets = (g.__educonnectRate ??= new Map());

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
  return {
    ok: b.count <= limit,
    remaining: Math.max(0, limit - b.count),
    retryAfterSeconds: Math.max(0, Math.ceil((b.resetAt - now) / 1000)),
  };
}

export const LIMITS = {
  login: { limit: 8, windowMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  ai: { limit: 30, windowMs: 10 * 60_000 },
  connectionRequest: { limit: 20, windowMs: 60 * 60_000 },
  report: { limit: 10, windowMs: 60 * 60_000 },
} as const;
