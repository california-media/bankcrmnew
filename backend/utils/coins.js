const DEFAULT_SEGMENTS = [
  { coins: 5, weight: 30 },
  { coins: 10, weight: 30 },
  { coins: 20, weight: 20 },
  { coins: 50, weight: 6 },
  { coins: 10, weight: 10 },
  { coins: 100, weight: 4 },
];

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// Upper bound for admin-set coin values and weights. Keeps the spin draw total
// (8 segments x 1e6 x 100 scaling) far below crypto.randomInt's 2^48 limit.
const MAX_COIN_SETTING = 1000000;
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' });

const dubaiDayKey = (date) => dayFmt.format(date);

// Dubai is fixed UTC+4, so the next 00:00 Dubai is 20:00Z of the current Dubai day.
const nextDubaiMidnight = (date) => {
  const [y, m, d] = dubaiDayKey(date).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1) - DUBAI_OFFSET_MS);
};

// 00:00 Dubai of the Dubai day containing `date` (fixed offset, so always 24h before the next one).
const dubaiDayStart = (date) => new Date(nextDubaiMidnight(date).getTime() - DAY_MS);

// Mongo filter part: no expiry, or a validUntil whose Dubai day is today or later,
// i.e. a voucher stays valid through the whole Dubai day of its validUntil.
const voucherValidFilter = (now) => ({
  $or: [{ validUntil: null }, { validUntil: { $gte: dubaiDayStart(now) } }],
});

const validateSpinSegments = (segs) => {
  if (!Array.isArray(segs) || segs.length < 4 || segs.length > 8) {
    return 'Spin wheel needs 4 to 8 segments';
  }
  for (const s of segs) {
    if (!s || !Number.isInteger(s.coins) || s.coins < 0) {
      return 'Segment coins must be an integer of 0 or more';
    }
    if (s.coins > MAX_COIN_SETTING) return 'Segment coins must be at most 1,000,000';
    if (typeof s.weight !== 'number' || !Number.isFinite(s.weight) || s.weight < 0.01) {
      return 'Segment weight must be a number of at least 0.01';
    }
    if (s.weight > MAX_COIN_SETTING) return 'Segment weight must be at most 1,000,000';
  }
  return null;
};

const validateInviteReward = (v) => {
  if (!Number.isInteger(v) || v < 0) return 'Invite reward must be a whole number of coins';
  if (v > MAX_COIN_SETTING) return 'Invite reward must be at most 1,000,000 coins';
  return null;
};

// Weights are scaled to integers for the draw: as-is when all are whole numbers,
// otherwise x100 (two decimals of precision).
const pickSegmentIndex = (segs, randInt) => {
  const factor = segs.every((s) => Number.isInteger(s.weight)) ? 1 : 100;
  const scaled = (w) => Math.round(w * factor);
  const total = segs.reduce((sum, s) => sum + scaled(s.weight), 0);
  const r = randInt(total);
  let cum = 0;
  for (let i = 0; i < segs.length; i++) {
    cum += scaled(segs[i].weight);
    if (cum > r) return i;
  }
  return segs.length - 1;
};

const chancePcts = (segs) => {
  const total = segs.reduce((sum, s) => sum + s.weight, 0);
  return segs.map((s) => Math.round((s.weight / total) * 1000) / 10);
};

const parseVoucherCodes = (text) => {
  const seen = new Set();
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const code = line.trim();
    if (!code || code.length > 64 || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
};

// First column of spreadsheet rows (sheet_to_json header:1, raw:true) -> code strings.
// A leading 'code'/'codes' header cell is skipped. Blank cells are dropped.
const codesFromSheetRows = (rows) => {
  const out = [];
  (rows || []).forEach((r, i) => {
    const cell = Array.isArray(r) ? r[0] : undefined;
    if (cell === undefined || cell === null) return;
    const v = String(cell).trim();
    if (!v) return;
    if (i === 0 && ['code', 'codes'].includes(v.toLowerCase())) return;
    out.push(v);
  });
  return out;
};

// ── Levels, streaks, challenges (plan H) ──────────────────────────────────

const DEFAULT_TIERS = [
  { name: 'Silver', minCoins: 0 },
  { name: 'Gold', minCoins: 2000 },
  { name: 'Platinum', minCoins: 6000 },
];
const DEFAULT_STREAK_BONUSES = [{ days: 7, coins: 500 }, { days: 30, coins: 3000 }];
const MAX_PROMO_TEXT = 120;
const ACTIVITY_TYPES = ['share_link', 'watch_guide'];
// Fixed challenge catalogue: titles/subtitles/periods are fixed, enabled/target/coins are admin-set.
// `{n}` in a title is replaced by the target.
const MISSION_DEFS = [
  { key: 'submit_leads', title: 'Submit {n} leads this month', subtitle: 'Every lead counts', period: 'month', target: 6, coins: 300 },
  { key: 'share_link', title: 'Share your link this week', subtitle: 'WhatsApp, email or QR', period: 'week', target: 1, coins: 50 },
  { key: 'consents', title: 'Get {n} consents', subtitle: 'Clients reply YES', period: 'month', target: 3, coins: 150 },
  { key: 'approvals', title: '{n} approvals this month', subtitle: 'Bank-approved applications', period: 'month', target: 3, coins: 400 },
  { key: 'watch_guide', title: "Watch Sara's guide", subtitle: 'Learn the full journey', period: 'once', target: 1, coins: 100 },
];
const MAX_MISSION_TARGET = 1000;
const defaultMissions = () => MISSION_DEFS.map(({ key, target, coins }) => ({ key, enabled: true, target, coins }));

// 'YYYY-MM-DD' + delta days (calendar arithmetic, no timezone involved).
const shiftDayKey = (key, delta) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
};

// Consecutive days ending today, or yesterday when today is not in the list yet; 0 otherwise.
const streakDays = (dayKeys, todayKey) => {
  const set = new Set(dayKeys);
  let k = set.has(todayKey) ? todayKey : shiftDayKey(todayKey, -1);
  let n = 0;
  while (set.has(k)) {
    n += 1;
    k = shiftDayKey(k, -1);
  }
  return n;
};

// Smallest configured bonus still ahead of the current streak, or null.
const nextBonus = (bonuses, days) => {
  const ahead = (bonuses || []).filter((b) => b.days > days).sort((a, b) => a.days - b.days)[0];
  return ahead ? { days: ahead.days, coins: ahead.coins } : null;
};

// tiers ascending by minCoins, first at 0. Highest tier reached + the one after it (null at the top).
const tierFor = (tiers, lifetime) => {
  let i = 0;
  while (i + 1 < tiers.length && lifetime >= tiers[i + 1].minCoins) i += 1;
  return { tier: tiers[i], nextTier: tiers[i + 1] || null };
};

const dubaiParts = (date) => dubaiDayKey(date).split('-').map(Number);

// ISO-8601 week (Mon start) of the Dubai calendar day: 'YYYY-Www' with the ISO week-year.
const dubaiWeekKey = (date) => {
  const [y, m, d] = dubaiParts(date);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow); // the Thursday of this week decides the year
  const isoYear = t.getUTCFullYear();
  const week = Math.ceil(((t - Date.UTC(isoYear, 0, 1)) / DAY_MS + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
};

// The Dubai week (Mon..Sun) as dayKeys, for range filters on dayKey strings.
const dubaiWeekRange = (date) => {
  const today = dubaiDayKey(date);
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
  return { key: dubaiWeekKey(date), startKey: shiftDayKey(today, 1 - dow), endKey: shiftDayKey(today, 7 - dow) };
};

// The Dubai calendar month containing `date`: { key:'YYYY-MM', start, end } with [start, end) as UTC instants.
const dubaiMonthRange = (date) => {
  const [y, m] = dubaiParts(date);
  return {
    key: `${y}-${String(m).padStart(2, '0')}`,
    start: new Date(Date.UTC(y, m - 1, 1) - DUBAI_OFFSET_MS),
    end: new Date(Date.UTC(y, m, 1) - DUBAI_OFFSET_MS),
  };
};

const missionTitle = (title, target) => title.replace('{n}', String(target));

// Stored admin config laid over the fixed catalogue, in catalogue order (unknown stored keys are ignored).
const resolveMissions = (stored) => {
  const byKey = new Map((stored || []).map((m) => [m.key, m]));
  return MISSION_DEFS.map((d) => {
    const s = byKey.get(d.key);
    const target = s && Number.isInteger(s.target) && s.target >= 1 ? s.target : d.target;
    const coins = s && Number.isInteger(s.coins) && s.coins >= 0 ? s.coins : d.coins;
    return {
      key: d.key, title: missionTitle(d.title, target), subtitle: d.subtitle, period: d.period,
      enabled: s ? s.enabled !== false : true, target, coins,
    };
  });
};

const validateTiers = (tiers) => {
  if (!Array.isArray(tiers) || tiers.length < 1 || tiers.length > 10) return 'Levels need 1 to 10 rows';
  const names = new Set();
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    const name = t && typeof t.name === 'string' ? t.name.trim() : '';
    if (!name || name.length > 30) return 'Each level needs a name of up to 30 characters';
    if (names.has(name.toLowerCase())) return 'Level names must be unique';
    names.add(name.toLowerCase());
    if (!Number.isInteger(t.minCoins) || t.minCoins < 0) return 'Level minimum coins must be a whole number of 0 or more';
    if (t.minCoins > MAX_COIN_SETTING) return 'Level minimum coins must be at most 1,000,000';
    if (i === 0 && t.minCoins !== 0) return 'The first level must start at 0 coins';
    if (i > 0 && t.minCoins <= tiers[i - 1].minCoins) return 'Each level must need more coins than the one before';
  }
  return null;
};

const validateStreakBonuses = (list) => {
  if (!Array.isArray(list) || list.length > 10) return 'Streak bonuses must be a list of at most 10 rows';
  const seen = new Set();
  for (const b of list) {
    if (!b || !Number.isInteger(b.days) || b.days < 2 || b.days > 365) return 'Streak days must be a whole number from 2 to 365';
    if (seen.has(b.days)) return 'Each streak bonus needs different days';
    seen.add(b.days);
    if (!Number.isInteger(b.coins) || b.coins < 1) return 'Streak bonus coins must be a whole number of 1 or more';
    if (b.coins > MAX_COIN_SETTING) return 'Streak bonus coins must be at most 1,000,000';
  }
  return null;
};

const validatePromoText = (v) => {
  if (typeof v !== 'string') return 'Promo text must be text';
  if (v.trim().length > MAX_PROMO_TEXT) return 'Promo text must be at most 120 characters';
  return null;
};

const validateMissions = (list) => {
  if (!Array.isArray(list)) return 'Challenges must be a list';
  const keys = new Set(MISSION_DEFS.map((d) => d.key));
  const seen = new Set();
  for (const m of list) {
    if (!m || !keys.has(m.key)) return 'Unknown challenge';
    if (seen.has(m.key)) return 'Each challenge can appear only once';
    seen.add(m.key);
    if (typeof m.enabled !== 'boolean') return 'Challenge on/off must be true or false';
    if (!Number.isInteger(m.target) || m.target < 1 || m.target > MAX_MISSION_TARGET) {
      return 'Challenge target must be a whole number from 1 to 1,000';
    }
    if (!Number.isInteger(m.coins) || m.coins < 0) return 'Challenge coins must be a whole number of 0 or more';
    if (m.coins > MAX_COIN_SETTING) return 'Challenge coins must be at most 1,000,000';
  }
  return null;
};

module.exports = {
  DEFAULT_SEGMENTS,
  dubaiDayKey,
  nextDubaiMidnight,
  dubaiDayStart,
  voucherValidFilter,
  validateSpinSegments,
  validateInviteReward,
  pickSegmentIndex,
  chancePcts,
  parseVoucherCodes,
  codesFromSheetRows,
  DEFAULT_TIERS,
  DEFAULT_STREAK_BONUSES,
  MAX_PROMO_TEXT,
  ACTIVITY_TYPES,
  MISSION_DEFS,
  defaultMissions,
  shiftDayKey,
  streakDays,
  nextBonus,
  tierFor,
  dubaiWeekKey,
  dubaiWeekRange,
  dubaiMonthRange,
  missionTitle,
  resolveMissions,
  validateTiers,
  validateStreakBonuses,
  validatePromoText,
  validateMissions,
};
