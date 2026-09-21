const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

class TtlCache {
  // maxEntries bounds worst-case memory regardless of request volume or
  // how many distinct IPs are involved -- keys are attacker-controlled
  // (arbitrary :id path segments, including ones that never resolve to a
  // real video), so without a hard cap a flood of unique junk ids grows
  // this without bound. The rate limiter only throttles per-IP throughput,
  // not cumulative size, so it can't substitute for this.
  constructor(defaultTtlMs, maxEntries = Infinity) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
    this.store = new Map();

    setInterval(() => this.sweepExpired(), SWEEP_INTERVAL_MS).unref();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    // Map preserves insertion order, so the first key is the oldest --
    // evict it before growing past the cap.
    if (!this.store.has(key) && this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  sweepExpired() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

module.exports = { TtlCache };
