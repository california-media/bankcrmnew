// Redirect targets for the UAE PASS flow.
// - App (mobile) targets: only URLs starting with an allowlisted prefix.
// - Web targets: only the CLIENT_URL origin or an explicitly allowlisted origin.
// Plus PKCE (RFC 7636, S256 only) helpers that bind the app's one-time code to the device.

const crypto = require('crypto');

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

// PKCE S256: base64url(sha256(ascii(verifier))), no '=' padding — always 43 characters.
function pkceChallengeOf(verifier) {
  return crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

// A code_challenge as the app must send it: 43 base64url characters.
function isValidChallenge(challenge) {
  return typeof challenge === 'string' && /^[A-Za-z0-9_-]{43}$/.test(challenge);
}

// A code_verifier per RFC 7636: 43–128 unreserved characters [A-Za-z0-9-._~].
function isValidVerifier(verifier) {
  return typeof verifier === 'string' && /^[A-Za-z0-9\-._~]{43,128}$/.test(verifier);
}

// Constant-time check that verifier hashes to the stored challenge.
function pkceMatches(verifier, challenge) {
  if (!isValidVerifier(verifier) || !isValidChallenge(challenge)) return false;
  const expected = Buffer.from(challenge, 'ascii');
  const actual = Buffer.from(pkceChallengeOf(verifier), 'ascii');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = {
  isAllowedAppRedirect,
  safeWebOrigin,
  appRedirectUrl,
  pkceChallengeOf,
  isValidChallenge,
  isValidVerifier,
  pkceMatches,
};
