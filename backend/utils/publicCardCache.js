// Short in-memory cache for the public card list (website + referral form).
// Card edits clear it right away; bank/category edits show within TTL_MS.
const TTL_MS = 60 * 1000;
const cache = new Map();

exports.getCached = (key) => {
  const hit = cache.get(key);
  return hit && Date.now() - hit.at < TTL_MS ? hit.data : null;
};

exports.setCached = (key, data) => cache.set(key, { data, at: Date.now() });

exports.clearPublicCardCache = () => cache.clear();
