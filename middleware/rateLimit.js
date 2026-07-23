// Small hand-rolled per-IP limiter — no need for a dependency for a single-tenant app. This is
// the first line of defense (caps how fast even the first few free attempts can be fired,
// before db.js's account-wide lockout kicks in); the lockout in routes/auth.js is the real
// brute-force defense, since it isn't bypassable by spreading requests across many IPs.
const buckets = new Map(); // ip -> { count, resetAt }

// Sweep expired buckets periodically so this doesn't grow unbounded against many distinct
// source IPs (e.g. a scanning botnet) over a long-running process.
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(ip);
  }
}, 5 * 60 * 1000).unref();

function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    let bucket = buckets.get(ip);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
    }
    bucket.count++;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests — slow down.', retryAfter });
    }
    next();
  };
}

module.exports = { rateLimit };
