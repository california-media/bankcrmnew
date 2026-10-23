const DEFAULT_SEGMENTS = [
  { coins: 5, weight: 30 },
  { coins: 10, weight: 30 },
  { coins: 20, weight: 20 },
  { coins: 50, weight: 6 },
  { coins: 10, weight: 10 },
  { coins: 100, weight: 4 },
];

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' });

const dubaiDayKey = (date) => dayFmt.format(date);

// Dubai is fixed UTC+4, so the next 00:00 Dubai is 20:00Z of the current Dubai day.
const nextDubaiMidnight = (date) => {
  const [y, m, d] = dubaiDayKey(date).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1) - DUBAI_OFFSET_MS);
};

const validateSpinSegments = (segs) => {
  if (!Array.isArray(segs) || segs.length < 4 || segs.length > 8) {
    return 'Spin wheel needs 4 to 8 segments';
  }
  for (const s of segs) {
    if (!s || !Number.isInteger(s.coins) || s.coins < 0) {
      return 'Segment coins must be an integer of 0 or more';
    }
    if (typeof s.weight !== 'number' || !Number.isFinite(s.weight) || s.weight < 0.01) {
      return 'Segment weight must be a number of at least 0.01';
    }
  }
  return null;
};

const validateInviteReward = (v) =>
  (Number.isInteger(v) && v >= 0 ? null : 'Invite reward must be a whole number of coins');

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

module.exports = {
  DEFAULT_SEGMENTS,
  dubaiDayKey,
  nextDubaiMidnight,
  validateSpinSegments,
  validateInviteReward,
  pickSegmentIndex,
  chancePcts,
  parseVoucherCodes,
};
