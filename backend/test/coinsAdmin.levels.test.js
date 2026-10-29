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
  });
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
  ];
  for (const extra of bad) {
    const res = await put({ ...BASE, ...extra });
    assert.equal(res.statusCode, 400, JSON.stringify(extra));
    assert.ok(res.body.message);
  }
  assert.equal(doc.saved, 0);
});
