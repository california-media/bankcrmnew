// Small in-memory per-key rate limiter (per process, resets on deploy). Keys whose hits have all aged out of the
// window are dropped on the next hit, so the map doesn't grow with every address ever seen.

function makeRateLimiter({ windowMs, max, now = () => Date.now() }) {
  const hits = new Map();

  function sweep(t) {
    for (const [key, list] of hits) {
      if (!list.length || t - list[list.length - 1] >= windowMs) hits.delete(key);
    }
  }

  /** Records a hit for `key`; true when this hit is over the limit. */
  function hit(key) {
    const t = now();
    sweep(t);
    const list = (hits.get(key) || []).filter((x) => t - x < windowMs);
    list.push(t);
    hits.set(key, list);
    return list.length > max;
  }

  return { hit, size: () => hits.size };
}

module.exports = { makeRateLimiter };
