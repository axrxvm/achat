const createRateLimiter = ({ windowMs = 60_000, max = 60, keyGenerator } = {}) => {
  const buckets = new Map();

  return (req, res, next) => {
    const key =
      typeof keyGenerator === "function"
        ? String(keyGenerator(req) || "")
        : String(req.ip || req.headers["x-forwarded-for"] || "unknown");

    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      return next();
    }

    if (current.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    current.count += 1;
    return next();
  };
};

module.exports = {
  createRateLimiter
};
