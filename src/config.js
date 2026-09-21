function parseHostList(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  port: Number(process.env.PORT) || 3000,

  // Host used for GET /w/:id (no explicit host segment).
  defaultHost: process.env.DEFAULT_HOST || 'video.nyc',

  // API base for the default host. Loopback by default since this service
  // is expected to run on the same box as PeerTube.
  localApiBase: process.env.LOCAL_API_BASE || 'http://127.0.0.1:9000',

  // GET /w/:host/:id is a 404 unless explicitly enabled + allowlisted,
  // otherwise this becomes an open outbound proxy.
  multiInstanceEnabled: process.env.MULTI_INSTANCE_ENABLED === 'true',
  allowedHosts: parseHostList(process.env.ALLOWED_HOSTS),

  cacheTtlMs: Number(process.env.CACHE_TTL_MS) || 60 * 60 * 1000, // 1h
  negativeCacheTtlMs: Number(process.env.NEGATIVE_CACHE_TTL_MS) || 5 * 60 * 1000, // 5m

  // Hard cap on the video-metadata cache's size (oldest entry evicted once
  // full). :id is attacker-controlled and negative lookups get cached too,
  // so this bounds memory against a flood of junk ids regardless of the
  // rate limiter.
  cacheMaxEntries: Number(process.env.CACHE_MAX_ENTRIES) || 5000,

  // Byte budget for picking a file to embed. Highest resolution that fits wins.
  defaultBudgetBytes: Number(process.env.DEFAULT_BUDGET_BYTES) || 25 * 1024 * 1024, // 25MB

  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 30,

  // Set to a number (proxy hop count) or true when behind Caddy/a load balancer,
  // so req.ip reflects the real client for rate limiting.
  trustProxy: process.env.TRUST_PROXY === 'true' ? true : (Number(process.env.TRUST_PROXY) || false),

  // silent | error | info | debug. info logs one JSON line per request
  // (chosen resolution/size, cache hit, status, timing) -- useful for
  // diagnosing slow embeds. debug adds the full picked file object.
  logLevel: process.env.LOG_LEVEL || 'info',
};
