// Admin can put {LEAD_NUMBER} anywhere in a product's "Redirect URL after
// submission" (e.g. utm_term={LEAD_NUMBER}); it's swapped for the lead's own
// number when the client is redirected, so the partner can match the click
// back to our lead. Also matches the URL-encoded form a browser may paste.
const LEAD_NUMBER_TOKEN = /\{LEAD_NUMBER\}|%7BLEAD_NUMBER%7D/gi;

function withLeadNumber(url, lead) {
  if (!url) return url;
  return url.replace(LEAD_NUMBER_TOKEN, encodeURIComponent(lead.leadNumber || String(lead._id)));
}

module.exports = { withLeadNumber };
