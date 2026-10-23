// Redirect targets for the UAE PASS flow.
// - App (mobile) targets: only URLs starting with an allowlisted prefix.
// - Web targets: only the CLIENT_URL origin or an explicitly allowlisted origin.

const DEFAULT_WEB_ORIGIN = 'http://localhost:5173';

const csvList = (csv) =>
  String(csv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// Origin of a URL string, or null when it isn't a usable http(s)-style origin.
const originOf = (value) => {
  try {
    const origin = new URL(value).origin;
    return origin && origin !== 'null' ? origin : null;
  } catch {
    return null;
  }
};

function isAllowedAppRedirect(url, allowCsv = process.env.UAEPASS_APP_REDIRECTS || 'mysilah://') {
  if (typeof url !== 'string' || !url) return false;
  // No whitespace / CR / LF / control characters anywhere.
  if (/[\s\x00-\x1f\x7f]/.test(url)) return false;
  return csvList(allowCsv).some((prefix) => url.startsWith(prefix));
}

function safeWebOrigin(candidate, clientUrl, extraCsv = process.env.UAEPASS_WEB_ORIGINS || '') {
  const fallback = originOf(clientUrl) || DEFAULT_WEB_ORIGIN;
  const origin = originOf(candidate);
  if (!origin) return fallback;
  if (origin === fallback) return origin;
  const extras = csvList(extraCsv).map(originOf).filter(Boolean);
  return extras.includes(origin) ? origin : fallback;
}

function appRedirectUrl(base, params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null) query.append(key, String(value));
  }
  const qs = query.toString();
  if (!qs) return base;
  const sep = base.includes('?') ? (/[?&]$/.test(base) ? '' : '&') : '?';
  return `${base}${sep}${qs}`;
}

module.exports = { isAllowedAppRedirect, safeWebOrigin, appRedirectUrl };
