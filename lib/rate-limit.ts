/**
 * Centralized sliding-window in-memory rate limiter with standard HTTP retry metadata.
 * Prevents brute-force, storage spam, and email quota abuse across all public APIs.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
}

export function getRequestIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  return fwd.split(",")[0].trim() || "unknown";
}

export function checkRateLimit(
  namespace: string,
  identifier: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const key = `${namespace}:${identifier}`;
  const bucket = buckets.get(key) ?? { hits: [] };
  const valid = bucket.hits.filter((t) => now - t < windowMs);

  if (valid.length >= limit) {
    const oldest = valid[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    buckets.set(key, { hits: valid });
    return { allowed: false, limit, remaining: 0, retryAfterSec };
  }

  valid.push(now);
  buckets.set(key, { hits: valid });

  // Opportunistic cleanup to keep memory bounded
  if (buckets.size > 5000) {
    for (const [k, b] of buckets.entries()) {
      if (!b.hits.some((t) => now - t < windowMs)) buckets.delete(k);
    }
  }

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - valid.length),
    retryAfterSec: 0,
  };
}

export function rateLimitHeaders(res: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(res.limit),
    "X-RateLimit-Remaining": String(res.remaining),
    ...(res.retryAfterSec > 0 ? { "Retry-After": String(res.retryAfterSec) } : {}),
  };
}
