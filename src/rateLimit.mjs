// Best-effort in-memory sliding-window rate limiter.
//
// Fully effective on the long-lived local `server.mjs`. On serverless (Vercel),
// instances are reused under Fluid Compute but not guaranteed, so this is
// defense-in-depth against bursts, not a hard cross-instance guarantee. Durable
// limiting would require a shared store (table/Redis) — intentionally out of scope.

const buckets = new Map();

export function rateLimit(key, { limit = 5, windowMs = 60_000 } = {}, now = Date.now()) {
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) || []).filter((ts) => ts > cutoff);

  if (hits.length >= limit) {
    return { allowed: false, retryAfterMs: hits[0] + windowMs - now };
  }

  hits.push(now);
  buckets.set(key, hits);

  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.some((ts) => ts > cutoff)) buckets.delete(k);
    }
  }

  return { allowed: true, retryAfterMs: 0 };
}

export function clientIp(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req?.socket?.remoteAddress || req?.connection?.remoteAddress || "unknown";
}

export function enforceCommentRateLimit(req, options = { limit: 5, windowMs: 60_000 }) {
  const result = rateLimit(`comment:${clientIp(req)}`, options);
  if (!result.allowed) {
    const error = new Error("Too many comments. Please wait a moment before posting again.");
    error.statusCode = 429;
    error.retryAfterMs = result.retryAfterMs;
    throw error;
  }
}

// Test helper: clears all buckets.
export function __resetRateLimit() {
  buckets.clear();
}
