const test = require('node:test');
const assert = require('node:assert/strict');
const { makeCoinsService } = require('../services/coins.service');
const { DEFAULT_TIERS, defaultMissions, shiftDayKey } = require('../utils/coins');

const SEGS = [
  { coins: 5, weight: 30 }, { coins: 10, weight: 30 }, { coins: 20, weight: 20 },
  { coins: 50, weight: 6 }, { coins: 10, weight: 10 }, { coins: 100, weight: 4 },
];
const NOW = new Date('2026-10-23T10:00:00Z'); // Friday 23 Oct 2026, 14:00 Dubai (week 2026-W43)
const dup = () => Object.assign(new Error('E11000'), { code: 11000 });
const chain = (docs) => { const c = { select: () => c, sort: () => c, limit: () => c, lean: async () => docs }; return c; };
// n consecutive dayKeys ending on `from` (default yesterday, 22 Oct), newest first.
const daysBack = (n, from = '2026-10-22') => Array.from({ length: n }, (_, i) => shiftDayKey(from, -i));

// In-memory fakes: CoinTransaction honours the unique {user, awardKey} index, SpinLog the unique {user, dayKey}.
function build(o = {}) {
  const txs = (o.txs || []).map((t) => ({ ...t }));
  const spinDays = [...(o.spinDays || [])];
  const activity = [...(o.activity || [])];
  let balance = o.balance === undefined ? 100 : o.balance;
  const calls = { userUpdate: [], leadCount: [], activityCount: [], statusFind: [], aggregate: [] };
  const settings = {
    spinEnabled: true, spinSegments: SEGS, tiers: DEFAULT_TIERS, promoText: '',
    streakBonuses: [{ days: 7, coins: 500 }, { days: 30, coins: 3000 }], missions: defaultMissions(), ...(o.settings || {}),
  };
  const deps = {
    now: () => NOW,
    randInt: () => 0, // segment 0: 5 coins
    notify: async () => {},
    CoinSettings: { getSingleton: async () => settings },
    User: {
      findOneAndUpdate: async (f, u) => {
        calls.userUpdate.push([f, u]);
        if (o.userNull) return null;
        balance += u.$inc.coinBalance;
        return { _id: f._id, coinBalance: balance };
      },
      findById: () => chain({ coinBalance: balance }),
    },
    SpinLog: {
      create: async (d) => { if (spinDays.includes(d.dayKey)) throw dup(); spinDays.push(d.dayKey); return { _id: 'log1', ...d }; },
      deleteOne: async () => {},
      find: () => chain([...spinDays].sort().reverse().map((dayKey) => ({ dayKey }))),
    },
    CoinTransaction: {
      create: async (d) => {
        if (o.awardThrows && d.awardKey) throw new Error('db down');
        if (d.awardKey && txs.some((t) => t.user === d.user && t.awardKey === d.awardKey)) throw dup();
        const t = { _id: `t${txs.length + 1}`, ...d };
        txs.push(t);
        return t;
      },
      updateOne: async (f, u) => { const t = txs.find((x) => x._id === f._id); if (t) Object.assign(t, u.$set); },
      deleteOne: async (f) => { const i = txs.findIndex((x) => x._id === f._id); if (i >= 0) txs.splice(i, 1); },
      aggregate: async (p) => {
        calls.aggregate.push(p);
        // Mirrors the $match: positive rows, minus once-only awards never credited (awardKey + balanceAfter 0).
        const total = txs.filter((t) => t.user === p[0].$match.user && t.amount > 0 && !(typeof t.awardKey === 'string' && t.balanceAfter === 0))
          .reduce((s, t) => s + t.amount, 0);
        return total ? [{ _id: null, total }] : [];
      },
      find: (f) => chain(txs.filter((t) => t.user === f.user && f.awardKey.$in.includes(t.awardKey))),
      exists: async (f) => (o.existsMiss ? null : (txs.some((t) => t.user === f.user && t.awardKey === f.awardKey) ? { _id: 'x' } : null)),
    },
    Lead: { countDocuments: async (f) => { calls.leadCount.push(f); return o.leadCount ? o.leadCount(f) : 0; } },
    CoinActivity: {
      create: async (d) => { if (activity.some((a) => a.type === d.type && a.dayKey === d.dayKey)) throw dup(); activity.push(d); return d; },
      countDocuments: async (f) => { calls.activityCount.push(f); return o.activityCount ? o.activityCount(f) : 0; },
    },
    EmployeeStatus: { find: (f) => { calls.statusFind.push(f); return chain((o.confirmedIds || ['cs1']).map((_id) => ({ _id }))); } },
  };
  return { svc: makeCoinsService(deps), calls, txs, activity, getBalance: () => balance };
}

/* ── spin streak bonus ─────────────────────────────────────────────── */

test('spin: the 7th day in a row pays the 7-day bonus in the same request', async () => {
  const { svc, txs } = build({ spinDays: daysBack(6) }); // 17..22 Oct
  const res = await svc.spin('u1');
  assert.deepEqual(res.streakBonus, { days: 7, coins: 500 });
  assert.equal(res.coins, 5);
  assert.equal(res.balance, 605); // 100 + 5 + 500
  const bonus = txs.find((t) => t.type === 'streak');
  assert.equal(bonus.awardKey, 'streak:7:2026-10'); // Dubai month of the award day
  assert.equal(bonus.title, '7-day streak bonus');
  assert.equal(bonus.amount, 500);
  assert.equal(bonus.balanceAfter, 605);
});

test('spin: a milestone already paid this Dubai month is not paid again (even for a new streak)', async () => {
  const { svc, calls, txs } = build({ spinDays: daysBack(6), txs: [{ _id: 't0', user: 'u1', type: 'streak', amount: 500, balanceAfter: 600, awardKey: 'streak:7:2026-10' }] });
  const res = await svc.spin('u1');
  assert.equal(res.streakBonus, null);
  assert.equal(res.balance, 105);
  assert.equal(calls.userUpdate.length, 1); // the spin only
  assert.equal(txs.filter((t) => t.type === 'streak').length, 1);
});

test('spin: no bonus off the exact day count, after a gap, or with none configured', async () => {
  let b = build({ spinDays: daysBack(7) }); // 8th day
  assert.equal((await b.svc.spin('u1')).streakBonus, null);
  b = build({ spinDays: daysBack(6, '2026-10-21') }); // missed yesterday: streak restarts at 1
  assert.equal((await b.svc.spin('u1')).streakBonus, null);
  b = build({ spinDays: daysBack(6), settings: { streakBonuses: [] } });
  const r = await b.svc.spin('u1');
  assert.equal(r.streakBonus, null);
  assert.equal(r.balance, 105);
});

test('spin: 30-day bonus uses the streak start as its key', async () => {
  const { svc, txs } = build({ spinDays: daysBack(29) }); // 24 Sep .. 22 Oct
  const res = await svc.spin('u1');
  assert.deepEqual(res.streakBonus, { days: 30, coins: 3000 });
  assert.equal(txs.find((t) => t.type === 'streak').awardKey, 'streak:30:2026-10');
});

test('spin: last month\'s milestone does not block this month\'s', async () => {
  const { svc, txs } = build({ spinDays: daysBack(6), txs: [{ _id: 't0', user: 'u1', type: 'streak', amount: 500, balanceAfter: 600, awardKey: 'streak:7:2026-09' }] });
  const res = await svc.spin('u1');
  assert.deepEqual(res.streakBonus, { days: 7, coins: 500 });
  assert.equal(txs.at(-1).awardKey, 'streak:7:2026-10');
});

test('spin: a failing bonus never fails the paid spin', async () => {
  const { svc } = build({ spinDays: daysBack(6), awardThrows: true });
  const res = await svc.spin('u1');
  assert.equal(res.streakBonus, null);
  assert.equal(res.balance, 105);
});

/* ── summary ───────────────────────────────────────────────────────── */

test('summary: lifetime from positive ledger rows, tier, streak, next bonus, promo', async () => {
  const { svc, calls } = build({
    balance: 2200,
    spinDays: ['2026-10-22', '2026-10-21'],
    txs: [
      { user: 'u1', amount: 500 }, { user: 'u1', amount: 2000 }, { user: 'u1', amount: -300 }, { user: 'u2', amount: 9000 },
      { user: 'u1', amount: 300, awardKey: 'mission:consents:2026-10', balanceAfter: 0 }, // guard row never credited
    ],
    settings: { promoText: 'Double coins Friday' },
  });
  const s = await svc.summary('u1');
  assert.deepEqual(s, {
    balance: 2200,
    lifetime: 2500,
    tier: { name: 'Gold', minCoins: 2000 },
    nextTier: { name: 'Platinum', minCoins: 6000 },
    tiers: DEFAULT_TIERS,
    streak: { days: 2, spunToday: false, nextBonus: { days: 7, coins: 500 } },
    promoText: 'Double coins Friday',
  });
  assert.deepEqual(calls.aggregate[0][0], {
    $match: { user: 'u1', amount: { $gt: 0 }, $nor: [{ awardKey: { $type: 'string' }, balanceAfter: 0 }] },
  });
});

test('summary: new agent at the bottom; top tier and long streak have nothing next', async () => {
  let s = await build({ balance: undefined }).svc.summary('u1');
  assert.equal(s.lifetime, 0);
  assert.deepEqual(s.tier, { name: 'Silver', minCoins: 0 });
  assert.deepEqual(s.streak, { days: 0, spunToday: false, nextBonus: { days: 7, coins: 500 } });
  assert.equal(s.promoText, '');
  s = await build({ txs: [{ user: 'u1', amount: 7000 }], spinDays: ['2026-10-23', ...daysBack(30)] }).svc.summary('u1');
  assert.deepEqual(s.tier, { name: 'Platinum', minCoins: 6000 });
  assert.equal(s.nextTier, null);
  assert.deepEqual(s.streak, { days: 31, spunToday: true, nextBonus: null });
});

/* ── missions ──────────────────────────────────────────────────────── */

const counts = {
  leadCount: (f) => (f.status && f.status.$ne === 'draft' ? 6 : f.consentStatus ? 1 : 2),
  activityCount: (f) => (f.type === 'share_link' ? 1 : 0),
};

test('missions: enabled only, config order, progress per rule on Dubai periods, claimed per period', async () => {
  const settings = { missions: defaultMissions().map((m) => (m.key === 'approvals' ? { ...m, enabled: false } : m)) };
  const { svc, calls } = build({
    ...counts, settings,
    txs: [
      { user: 'u1', awardKey: 'mission:share_link:2026-W43' },
      { user: 'u1', awardKey: 'mission:submit_leads:2026-09' }, // last month's claim does not count
    ],
  });
  const { items } = await svc.missions('u1');
  assert.deepEqual(items, [
    { key: 'submit_leads', title: 'Submit 6 leads this month', subtitle: 'Every lead counts', target: 6, progress: 6, coins: 300, period: 'month', claimed: false },
    { key: 'share_link', title: 'Share your link this week', subtitle: 'WhatsApp, email or QR', target: 1, progress: 1, coins: 50, period: 'week', claimed: true },
    { key: 'consents', title: 'Get 3 consents', subtitle: 'Clients reply YES', target: 3, progress: 1, coins: 150, period: 'month', claimed: false },
    { key: 'watch_guide', title: "Watch Sara's guide", subtitle: 'Learn the full journey', target: 1, progress: 0, coins: 100, period: 'once', claimed: false },
  ]);
  const month = { $gte: new Date('2026-09-30T20:00:00Z'), $lt: new Date('2026-10-31T20:00:00Z') };
  assert.deepEqual(calls.leadCount[0], { agent: 'u1', status: { $ne: 'draft' }, createdAt: month });
  assert.deepEqual(calls.leadCount[1], { agent: 'u1', createdAt: month, consentStatus: { $in: ['cs1'] } });
  assert.deepEqual(calls.activityCount[0], { user: 'u1', type: 'share_link', dayKey: { $gte: '2026-10-19', $lte: '2026-10-25' } });
  assert.deepEqual(calls.activityCount[1], { user: 'u1', type: 'watch_guide' });
  assert.equal(calls.statusFind[0].statusType, 'whatsapp_consent');
  assert.ok(calls.statusFind[0].label.$regex.test('Consent Confirmed'));
});

test('missions: approvals counts approved + disbursed created this Dubai month; no confirmed status -> 0 consents', async () => {
  const { svc, calls } = build({ confirmedIds: [], leadCount: () => 3 });
  const { items } = await svc.missions('u1');
  assert.equal(items.find((m) => m.key === 'consents').progress, 0);
  assert.equal(items.find((m) => m.key === 'approvals').progress, 3);
  assert.ok(calls.leadCount.some((f) => f.status && f.status.$in && f.status.$in.join() === 'approved,disbursed'));
  assert.ok(!calls.leadCount.some((f) => f.consentStatus));
});

test('claim: pays once with the ledger title and period key; second claim 409', async () => {
  const { svc, txs, getBalance } = build({ ...counts });
  const r = await svc.claimMission('u1', 'submit_leads');
  assert.deepEqual(r, { coins: 300, balance: 400 });
  const tx = txs.find((t) => t.type === 'mission');
  assert.equal(tx.awardKey, 'mission:submit_leads:2026-10');
  assert.equal(tx.title, 'Challenge: Submit 6 leads this month');
  assert.equal(tx.balanceAfter, 400);
  await assert.rejects(svc.claimMission('u1', 'submit_leads'), { status: 409 });
  assert.equal(getBalance(), 400);
  await svc.claimMission('u1', 'share_link');
  assert.equal(txs.at(-1).awardKey, 'mission:share_link:2026-W43');
});

test('claim: 400 not ready, 404 unknown or disabled, 409 on a lost race', async () => {
  let b = build({ ...counts });
  await assert.rejects(b.svc.claimMission('u1', 'consents'), { status: 400 }); // 1 of 3
  await assert.rejects(b.svc.claimMission('u1', 'watch_guide'), { status: 400 }); // 0 of 1
  await assert.rejects(b.svc.claimMission('u1', 'nope'), { status: 404 });
  b = build({ ...counts, settings: { missions: defaultMissions().map((m) => ({ ...m, enabled: false })) } });
  await assert.rejects(b.svc.claimMission('u1', 'submit_leads'), { status: 404 });
  // The pre-check missed a parallel claim; the unique award key still stops the second payment.
  b = build({ ...counts, existsMiss: true, txs: [{ user: 'u1', awardKey: 'mission:submit_leads:2026-10' }] });
  await assert.rejects(b.svc.claimMission('u1', 'submit_leads'), { status: 409 });
  assert.equal(b.calls.userUpdate.length, 0);
  assert.equal(b.getBalance(), 100);
});

test('claim: once-only mission uses the "once" key and an edited target in the title', async () => {
  const settings = { missions: defaultMissions().map((m) => (m.key === 'submit_leads' ? { ...m, target: 2, coins: 40 } : m)) };
  const { svc, txs } = build({ ...counts, settings, activityCount: () => 1 });
  await svc.claimMission('u1', 'watch_guide');
  assert.equal(txs[0].awardKey, 'mission:watch_guide:once');
  assert.equal(txs[0].title, "Challenge: Watch Sara's guide");
  await svc.claimMission('u1', 'submit_leads');
  assert.equal(txs[1].title, 'Challenge: Submit 2 leads this month');
  assert.equal(txs[1].amount, 40);
});

test('claim: user gone -> guard row removed so a retry can pay, 404', async () => {
  const { svc, txs } = build({ ...counts, userNull: true });
  await assert.rejects(svc.claimMission('u1', 'submit_leads'), { status: 404 });
  assert.equal(txs.length, 0);
});

/* ── activity ──────────────────────────────────────────────────────── */

test('activity: one row per type per Dubai day; repeats are fine; unknown type 400', async () => {
  const { svc, activity } = build();
  await svc.recordActivity('u1', 'share_link');
  await svc.recordActivity('u1', 'share_link');
  await svc.recordActivity('u1', 'watch_guide');
  assert.deepEqual(activity, [
    { user: 'u1', type: 'share_link', dayKey: '2026-10-23' },
    { user: 'u1', type: 'watch_guide', dayKey: '2026-10-23' },
  ]);
  await assert.rejects(svc.recordActivity('u1', 'tool'), { status: 400 });
  await assert.rejects(svc.recordActivity('u1', undefined), { status: 400 });
});

/* ── controller wiring ─────────────────────────────────────────────── */

const coins = require('../services/coins.service');
const ctrl = require('../controllers/coins.controller');
const fakeRes = () => {
  const r = { statusCode: 200, body: undefined, ended: false };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => { r.ended = true; return r; };
  return r;
};

test('controller: POST /spin returns streakBonus; POST /activity 204; claim errors keep their status', async (t) => {
  t.mock.method(coins, 'spin', async () => ({ segmentIndex: 1, coins: 10, balance: 610, streakBonus: { days: 7, coins: 500 } }));
  let res = fakeRes();
  await ctrl.postSpin({ user: { _id: 'u1' } }, res);
  assert.deepEqual(res.body, { segmentIndex: 1, coins: 10, balance: 610, streakBonus: { days: 7, coins: 500 } });

  let got;
  t.mock.method(coins, 'recordActivity', async (u, type) => { got = type; });
  res = fakeRes();
  await ctrl.activity({ user: { _id: 'u1' }, body: { type: 'share_link' } }, res);
  assert.equal(res.statusCode, 204);
  assert.ok(res.ended);
  assert.equal(got, 'share_link');

  t.mock.method(coins, 'claimMission', async () => { throw coins.httpError(409, 'Already claimed'); });
  res = fakeRes();
  await ctrl.claimMission({ user: { _id: 'u1' }, params: { key: 'submit_leads' } }, res);
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { message: 'Already claimed' });
});
