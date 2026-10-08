// Minimal fixed-window rate limiting, kept in memory like the session store
// (and with the same single-process caveat). Without it, anyone could burn
// through the Groq quota, grow the session store without bound, or walk
// through phone numbers to see who has appointments with a psychiatrist.

export function createRateLimiter({ windowMs, max }) {
  const hits = new Map(); // key -> { count, resetAt }

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs);
  sweep.unref?.();

  /** Records one hit for `key`. @returns {{ok: true} | {ok: false, retryAfterSec: number}} */
  function consume(key, now = Date.now()) {
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) return { ok: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
    return { ok: true };
  }

  return { consume, reset: () => hits.clear() };
}

const MINUTE = 60_000;

// Shared across the REST API and the chat flows, so the same person can't
// get around a limit by switching from one surface to the other.
export const limiters = {
  chat: createRateLimiter({ windowMs: MINUTE, max: 30 }),
  session: createRateLimiter({ windowMs: 10 * MINUTE, max: 30 }),
  phoneLookup: createRateLimiter({ windowMs: 10 * MINUTE, max: 15 }),
  booking: createRateLimiter({ windowMs: 60 * MINUTE, max: 15 }),
  hmsVerify: createRateLimiter({ windowMs: 60 * MINUTE, max: 8 }),
  // E-mailed verification codes from the chat: per client, and per address
  // (so nobody can flood someone else's inbox).
  emailCodePerIp: createRateLimiter({ windowMs: 10 * MINUTE, max: 10 }),
  emailCodePerAddress: createRateLimiter({ windowMs: 10 * MINUTE, max: 3 }),
  // Voice notes: Whisper allows 20 a minute for the whole app.
  transcribe: createRateLimiter({ windowMs: MINUTE, max: 6 }),
};

export const TOO_MANY_REQUESTS = "Too many requests — please wait a few minutes and try again.";

/** Express middleware applying `limiter` per client IP. */
export function limitByIp(limiter, message = TOO_MANY_REQUESTS) {
  return (req, res, next) => {
    const result = limiter.consume(req.ip || "unknown");
    if (result.ok) return next();
    res.setHeader("Retry-After", String(result.retryAfterSec));
    res.status(429).json({ error: message });
  };
}
