const test = require('node:test');
const assert = require('node:assert/strict');
const CoinSettings = require('../models/CoinSettings');
const ctrl = require('../controllers/coinsAdmin.controller');
const { DEFAULT_SEGMENTS, DEFAULT_TIERS, DEFAULT_STREAK_BONUSES, defaultMissions } = require('../utils/coins');

const fakeRes = () => {
  const r = { statusCode: 200, body: undefined };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};
const BASE = { spinEnabled: true, spinSegments: DEFAULT_SEGMENTS, inviteEnabled: true, inviteReward: 1000 };

function stubDoc(t, extra = {}) {
  const doc = {
    ...BASE,
    tiers: [{ name: 'Bronze', minCoins: 0 }, { name: 'Gold', minCoins: 500 }],
    streakBonuses: [{ days: 5, coins: 50 }],
    promoText: 'Keep going',
    missions: defaultMissions().map((m) => (m.key === 'consents' ? { ...m, enabled: false, target: 4 } : m)),
    saved: 0,
    ...extra,
  };
  doc.save = async () => { doc.saved += 1; };
  t.mock.method(CoinSettings, 'getSingleton', async () => doc);
  return doc;
}
const put = async (body) => { const res = fakeRes(); await ctrl.updateSettings({ body, user: { _id: 'admin1' } }, res); return res; };

test('GET settings includes levels, streak bonuses, promo text and challenges', async (t) => {
  stubDoc(t);
  const res = fakeRes();
  await ctrl.getSettings({}, res);
  assert.deepEqual(res.body.tiers, [{ name: 'Bronze', minCoins: 0 }, { name: 'Gold', minCoins: 500 }]);
  assert.deepEqual(res.body.streakBonuses, [{ days: 5, coins: 50 }]);
  assert.equal(res.body.promoText, 'Keep going');
  assert.equal(res.body.missions.length, 5);
  assert.deepEqual(res.body.missions[2], {
    key: 'consents', title: 'Get 4 consents', subtitle: 'Clients reply YES', period: 'month', enabled: false, target: 4, coins: 150,
    titleTemplate: 'Get {n} consents', maxTarget: 1000,
  });
  assert.equal(res.body.missions[1].maxTarget, 7);
  assert.equal(res.body.missions[4].maxTarget, 1);
});

test('PUT without the new fields keeps their current values (old website build)', async (t) => {
  const doc = stubDoc(t);
  const res = await put({ ...BASE, inviteReward: 700 });
  assert.equal(res.statusCode, 200);
  assert.equal(doc.inviteReward, 700);
  assert.deepEqual(doc.tiers, [{ name: 'Bronze', minCoins: 0 }, { name: 'Gold', minCoins: 500 }]);
  assert.deepEqual(doc.streakBonuses, [{ days: 5, coins: 50 }]);
  assert.equal(doc.promoText, 'Keep going');
  assert.equal(doc.missions.find((m) => m.key === 'consents').target, 4);
  assert.equal(doc.saved, 1);
});

test('PUT saves cleaned values; missions merge by key', async (t) => {
  const doc = stubDoc(t);
  const res = await put({
    ...BASE,
    tiers: [{ name: ' Silver ', minCoins: 0 }, { name: 'Gold', minCoins: 2000 }, { name: 'Platinum', minCoins: 6000 }],
    streakBonuses: [{ days: 30, coins: 3000 }, { days: 7, coins: 500 }],
    promoText: '  Double coins this weekend  ',
    missions: [{ key: 'approvals', enabled: false, target: 5, coins: 999 }],
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(doc.tiers, DEFAULT_TIERS);
  assert.deepEqual(doc.streakBonuses, DEFAULT_STREAK_BONUSES);
  assert.equal(doc.promoText, 'Double coins this weekend');
  assert.deepEqual(doc.missions.find((m) => m.key === 'approvals'), { key: 'approvals', enabled: false, target: 5, coins: 999 });
  assert.deepEqual(doc.missions.find((m) => m.key === 'consents'), { key: 'consents', enabled: false, target: 4, coins: 150 }); // untouched
  assert.equal(res.body.missions.find((m) => m.key === 'approvals').title, '5 approvals this month');
  assert.equal(doc.updatedBy, 'admin1');
});

test('PUT rejects invalid new fields with 400 and saves nothing', async (t) => {
  const doc = stubDoc(t);
  const bad = [
    { tiers: [] },
    { tiers: [{ name: 'A', minCoins: 10 }] },
    { tiers: [{ name: 'A', minCoins: 0 }, { name: 'B', minCoins: 0 }] },
    { tiers: [{ name: 'A', minCoins: 0 }, { name: 'a', minCoins: 10 }] },
    { tiers: [{ name: 'A', minCoins: 0 }, { name: 'B', minCoins: 1000001 }] },
    { streakBonuses: [{ days: 7, coins: 1000001 }] },
    { streakBonuses: [{ days: 0, coins: 5 }] },
    { promoText: 'x'.repeat(121) },
    { missions: [{ key: 'nope', enabled: true, target: 1, coins: 1 }] },
    { missions: [{ key: 'consents', enabled: true, target: 0, coins: 1 }] },
    { missions: [{ key: 'consents', enabled: true, target: 1, coins: 1000001 }] },
    { missions: [{ key: 'share_link', enabled: true, target: 8, coins: 1 }] },
    { missions: [{ key: 'watch_guide', enabled: true, target: 2, coins: 1 }] },
  ];
  for (const extra of bad) {
    const res = await put({ ...BASE, ...extra });
    assert.equal(res.statusCode, 400, JSON.stringify(extra));
    assert.ok(res.body.message);
  }
  assert.equal(doc.saved, 0);
});

/* ── getSingleton: no whole-doc save on read ───────────────────────── */

const mongoose = require('mongoose');

function stubSingleton(t, raw) {
  const calls = { updateOne: [], findById: 0, create: 0 };
  t.mock.method(CoinSettings, 'findOne', () => ({ lean: async () => (raw ? { ...raw } : null) }));
  t.mock.method(CoinSettings, 'updateOne', async (f, u, o) => { calls.updateOne.push([f, u, o]); return { matchedCount: 1 }; });
  t.mock.method(CoinSettings, 'findById', async (id) => { calls.findById += 1; return CoinSettings.hydrate({ ...raw, _id: id }); });
  t.mock.method(CoinSettings, 'create', async () => { calls.create += 1; return {}; });
  return calls;
}

test('getSingleton: an old singleton gets one conditional $set per missing field; parallel first reads all succeed', async (t) => {
  const id = new mongoose.Types.ObjectId();
  const calls = stubSingleton(t, { _id: id, spinEnabled: true, spinSegments: DEFAULT_SEGMENTS, inviteEnabled: false, inviteReward: 1000, updatedBy: null });
  const docs = await Promise.all([CoinSettings.getSingleton(), CoinSettings.getSingleton()]);
  assert.equal(docs.length, 2);
  const first = calls.updateOne.slice(0, 4);
  assert.deepEqual(first.map(([f]) => Object.keys(f)[1]).sort(), ['missions', 'promoText', 'streakBonuses', 'tiers']);
  for (const [f, u, o] of first) {
    const k = Object.keys(f)[1];
    assert.deepEqual(f, { _id: id, [k]: { $exists: false } });
    assert.deepEqual(Object.keys(u.$set), [k]);
    assert.deepEqual(o, { timestamps: false });
  }
  assert.deepEqual(first.find(([f]) => 'tiers' in f)[1].$set.tiers, DEFAULT_TIERS);
  assert.equal(calls.updateOne.length, 8); // 4 per call, each a no-op once another call has filled the field
  assert.equal(calls.findById, 2);
});

test('getSingleton: a complete singleton is returned without any write; none at all is created', async (t) => {
  const full = new CoinSettings({}).toObject();
  let calls = stubSingleton(t, full);
  const doc = await CoinSettings.getSingleton();
  assert.equal(calls.updateOne.length, 0);
  assert.equal(calls.findById, 0);
  assert.equal(doc.isModified(), false);
  assert.equal(doc.promoText, '');
  t.mock.restoreAll();
  calls = stubSingleton(t, null);
  await CoinSettings.getSingleton();
  assert.equal(calls.create, 1);
});
