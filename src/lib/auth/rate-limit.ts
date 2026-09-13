import "server-only";

/**
 * Fixed-window rate limiting for the auth endpoints (docs/reqs.md §35.11).
 *
 * In-memory, therefore per-instance: it raises the cost of a brute-force run
 * against a single deployment, and is honest about not being a distributed
 * limiter. Swap the store for Redis (or the platform's limiter) if the project
 * ever runs more than one instance.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit = 10,
  windowSeconds = 60,
): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);

  if (existing.count > limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }
  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds,
  };
}

/** Identifies the caller for limiting purposes; best effort behind a proxy. */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  return `${scope}:${ip}`;
}
