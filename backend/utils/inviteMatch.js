// Invite link taps (POST /api/public/invite-clicks) and the app's first-launch match
// (POST /api/public/invite-clicks/match): input cleaning and the matching rules.
// A tap is matched to an install by the same public IP and platform, then by the device details both sides sent.

const CODE_RE = /^[A-Z0-9]{4,16}$/;

/** An agent referral code from a link or a request, uppercased; null when it can't be one. */
function normalizeCode(raw) {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

const str = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 40) : null);
const num = (v) => {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 10000 ? n : null;
};

/** The device details a browser tap or an app launch sends, cleaned. */
function normalizeProbe(body) {
  const b = body && typeof body === 'object' ? body : {};
  const p = typeof b.platform === 'string' ? b.platform.trim().toLowerCase() : '';
  return {
    platform: p === 'ios' || p === 'android' ? p : 'other',
    osVersion: str(b.osVersion),
    screenW: num(b.screenW),
    screenH: num(b.screenH),
    pixelRatio: num(b.pixelRatio),
    timezone: str(b.timezone),
  };
}

function ipv4Private(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  const [a, b] = parts;
  return a === 127 || a === 10 || a === 0
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 169 && b === 254)
    || (a === 100 && b >= 64 && b <= 127);
}

/**
 * True for an address on the public internet. Loopback and private ones mean the server is not seeing the
 * caller (nginx not passing X-Forwarded-For), and matching on them would mix up everyone's taps.
 */
function isPublicIp(ip) {
  if (typeof ip !== 'string' || !ip.trim()) return false;
  let v = ip.trim().toLowerCase();
  if (v.startsWith('::ffff:')) v = v.slice(7);
  if (v.includes('.')) return !ipv4Private(v);
  if (v === '::1' || v === '::') return false;
  return !/^(fc|fd|fe[89ab])/.test(v);
}

/** Expands an IPv6 address to its 8 groups (no leading zeros); null when it isn't one. */
function ipv6Groups(v) {
  const halves = v.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  const groups = [...head, ...Array(Math.max(fill, 0)).fill('0'), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => g.replace(/^0+(?=.)/, ''));
}

/**
 * The network a tap or a launch comes from: an IPv4 address as is, an IPv6 address by its /64 (phones change the
 * rest of an IPv6 address often, and differently in the browser and the app). Used to store, match and rate-limit.
 */
function networkKey(ip) {
  if (typeof ip !== 'string' || !ip.trim()) return '';
  let v = ip.trim().toLowerCase();
  if (v.startsWith('::ffff:') && v.includes('.')) v = v.slice(7);
  if (v.includes('.')) return v;
  const groups = ipv6Groups(v);
  return groups ? `${groups.slice(0, 4).join(':')}::/64` : v;
}

const has = (v) => v !== null && v !== undefined;
const osMajor = (v) => {
  const m = typeof v === 'string' ? v.match(/\d+/) : null;
  return m ? Number(m[0]) : null;
};

function sameScreen(click, probe) {
  if (!has(click.screenW) || !has(click.screenH) || !has(probe.screenW) || !has(probe.screenH)) return true;
  const a = [click.screenW, click.screenH].sort((x, y) => x - y);
  const b = [probe.screenW, probe.screenH].sort((x, y) => x - y);
  return Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1;
}

function matches(click, probe) {
  if (!sameScreen(click, probe)) return false;
  if (has(click.pixelRatio) && has(probe.pixelRatio) && Math.abs(click.pixelRatio - probe.pixelRatio) >= 0.05) return false;
  if (has(click.timezone) && has(probe.timezone) && click.timezone !== probe.timezone) return false;
  // Safari can report a frozen iOS version, so the OS version only counts on Android. Chrome 110+ freezes its
  // Android user agent at "Android 10", so a tapped "10" says nothing (the landing page reads the real version
  // from navigator.userAgentData when the browser offers it).
  if (probe.platform === 'android') {
    const frozen = osMajor(click.osVersion) === 10;
    const a = frozen ? null : osMajor(click.osVersion);
    const b = osMajor(probe.osVersion);
    if (a !== null && b !== null && a !== b) return false;
  }
  return true;
}

/** The first (newest) tap whose details agree with the launching device; candidates are same IP and platform. */
function pickInviteClick(candidates, probe) {
  return (candidates || []).find((c) => matches(c, probe)) || null;
}

module.exports = { normalizeCode, normalizeProbe, isPublicIp, pickInviteClick, networkKey };
