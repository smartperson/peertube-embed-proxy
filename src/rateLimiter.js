const logger = require('./logger');

// Simple fixed-window per-IP limiter. Every hit here triggers an outbound
// request to a PeerTube API, so this exists to keep abuse cheap rather than
// to be precise. Caddy's rate_limit needs a plugin, so this runs in-process.
function createRateLimiter({ windowMs, max }) {
  const hits = new Map(); // ip -> { count, resetAt }

  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) {
      if (now > entry.resetAt) hits.delete(ip);
    }
  }, windowMs).unref();

  return function rateLimit(req, res, next) {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    let entry = hits.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      logger.info('rate_limited', { ip, count: entry.count, max });
      res.status(429).type('text/plain').send('Too Many Requests');
      return;
    }
    next();
  };
}

module.exports = { createRateLimiter };
