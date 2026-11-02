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

// The website (Hostinger) keeps its own copy of the card list inside the credit card page.
// Tell it to re-fetch after card saves; waits 2s so a burst of saves sends one ping.
const WEBSITE_REFRESH_URL = 'https://mysilah.ae/card-cache-refresh.php';
let notifyTimer = null;

exports.notifyWebsiteCardsChanged = () => {
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    fetch(WEBSITE_REFRESH_URL, { method: 'POST', signal: AbortSignal.timeout(15000) })
      .catch((err) => console.warn('[publicCardCache] website refresh ping failed:', err.message));
  }, 2000);
};
