const test = require('node:test');
const assert = require('node:assert/strict');
const Lead = require('../models/Lead');
const User = require('../models/User');
const EmployeeStatus = require('../models/EmployeeStatus');
const ctrl = require('../controllers/lead.controller');

// Model statics are stubbed per test (t.mock.method restores them); no DB is touched.
const fakeRes = () => {
  const r = { statusCode: 200, body: undefined };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};
const chain = (docs) => { const c = { select: () => c, lean: async () => docs }; return c; };
test.beforeEach(() => ctrl._clearLeaderboardCache());

function stubBoard(t, rows, agents) {
  const seen = { aggregates: 0 };
  t.mock.method(Lead, 'aggregate', async (p) => { seen.aggregates += 1; seen.pipeline = p; return rows.map(([id, closed]) => ({ _id: id, closed })); });
  t.mock.method(User, 'find', (f) => { seen.userFilter = f; return chain(agents.filter((a) => f._id.$in.includes(a._id))); });
  return seen;
}
const board = async (me) => { const res = fakeRes(); await ctrl.leaderboard({ user: me }, res); return res; };
const ME = { _id: 'me', name: 'Sara Ali Hassan' };

test('leaderboard: competition ranking, masked names, real name for me, Dubai month', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-31T21:00:00Z') }); // 1 Nov in Dubai
  const seen = stubBoard(t, [['a1', 5], ['a2', 5], ['me', 3], ['a3', 7], ['gone', 9]], [
    { _id: 'a1', name: 'Omar Rashid' }, { _id: 'a2', name: 'Aisha Khan' }, { _id: 'me', name: 'Sara Ali Hassan' }, { _id: 'a3', name: 'Lina' },
  ]);
  const res = await board(ME);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    month: '2026-11',
    me: { rank: 4, closed: 3, name: 'Sara Ali Hassan' },
    top: [
      { rank: 1, name: 'Lina', closed: 7, isMe: false },
      { rank: 2, name: 'Aisha K.', closed: 5, isMe: false },
      { rank: 2, name: 'Omar R.', closed: 5, isMe: false },
      { rank: 4, name: 'Sara Ali Hassan', closed: 3, isMe: true },
    ],
  });
  assert.deepEqual(seen.pipeline[0].$match, {
    productType: { $in: ['credit_card', 'loan', 'account'] },
    status: 'disbursed',
    createdAt: { $gte: new Date('2026-10-31T20:00:00Z'), $lt: new Date('2026-11-30T20:00:00Z') },
    agent: { $ne: null },
  });
  // Inactive / non-agent users drop out through the User filter.
  assert.equal(seen.userFilter.role, 'agent');
  assert.equal(seen.userFilter.isActive, true);
});

test('leaderboard: ties list me first; top is capped at 10', async (t) => {
  const others = Array.from({ length: 12 }, (_, i) => ({ _id: `a${i}`, name: `Agent ${String.fromCharCode(65 + i)}x` }));
  stubBoard(t, [['me', 4], ...others.map((a) => [a._id, 4])], [...others, { _id: 'me', name: ME.name }]);
  const res = await board(ME);
  assert.equal(res.body.top.length, 10);
  assert.deepEqual(res.body.top[0], { rank: 1, name: 'Sara Ali Hassan', closed: 4, isMe: true });
  assert.deepEqual(res.body.top[1], { rank: 1, name: 'Agent A.', closed: 4, isMe: false });
  assert.deepEqual(res.body.me, { rank: 1, closed: 4, name: 'Sara Ali Hassan' });
});

test('leaderboard: no closes for me -> ranked after everyone with more; empty month -> #1 with nothing listed', async (t) => {
  stubBoard(t, [['a1', 2], ['a2', 1]], [{ _id: 'a1', name: 'Omar Rashid' }, { _id: 'a2', name: 'Maya Sharma Khan' }]);
  let res = await board(ME);
  assert.deepEqual(res.body.me, { rank: 3, closed: 0, name: 'Sara Ali Hassan' });
  assert.deepEqual(res.body.top.map((r) => r.name), ['Omar R.', 'Maya K.']);
  t.mock.restoreAll();
  ctrl._clearLeaderboardCache();
  stubBoard(t, [], []);
  res = await board(ME);
  assert.deepEqual(res.body.me, { rank: 1, closed: 0, name: 'Sara Ali Hassan' });
  assert.deepEqual(res.body.top, []);
});

test('leaderboard: counts cached 60 s per month key; each caller still gets their own rank and name', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-23T10:00:00Z') });
  const seen = stubBoard(t, [['a1', 5], ['me', 3]], [{ _id: 'a1', name: 'Omar Rashid' }, { _id: 'me', name: 'Sara Ali Hassan' }]);
  let res = await board(ME);
  assert.deepEqual(res.body.me, { rank: 2, closed: 3, name: 'Sara Ali Hassan' });
  res = await board({ _id: 'a1', name: 'Omar Rashid' });
  assert.deepEqual(res.body.me, { rank: 1, closed: 5, name: 'Omar Rashid' });
  assert.deepEqual(res.body.top.map((r) => [r.name, r.isMe]), [['Omar Rashid', true], ['Sara H.', false]]);
  assert.equal(seen.aggregates, 1);
  t.mock.timers.tick(59 * 1000);
  await board(ME);
  assert.equal(seen.aggregates, 1);
  t.mock.timers.tick(2 * 1000); // 61 s
  await board(ME);
  assert.equal(seen.aggregates, 2);
  t.mock.timers.setTime(new Date('2026-10-31T20:00:10Z').getTime()); // new Dubai month: new key
  res = await board(ME);
  assert.equal(seen.aggregates, 3);
  assert.equal(res.body.month, '2026-11');
});

test('Lead has the month-count indexes', () => {
  const keys = Lead.schema.indexes().map(([k]) => JSON.stringify(k));
  assert.ok(keys.includes('{"agent":1,"createdAt":1}'));
  assert.ok(keys.includes('{"status":1,"createdAt":1}'));
});

/* ── /leads/stats additions ────────────────────────────────────────── */

test('stats: needConsent, approvalRate, lastMonth, trend; existing fields unchanged', async (t) => {
  const now = new Date();
  const at = (monthsBack, day) => new Date(now.getFullYear(), now.getMonth() - monthsBack, day, 12);
  const leads = [
    { status: 'draft', commissionStatus: 'none', createdAt: at(0, 1) },
    { status: 'submitted', commissionStatus: 'none', createdAt: at(0, 1) }, // unset consent -> needs it
    { status: 'under_review', commissionStatus: 'none', createdAt: at(1, 3), consentStatus: 'sent1' }, // sent -> needs it
    { status: 'assigned', commissionStatus: 'none', createdAt: at(1, 3), consentStatus: 'conf1' },
    { status: 'approved', commissionStatus: 'pending', commission: 70, createdAt: at(0, 1) }, // unset -> needs it
    { status: 'rejected', commissionStatus: 'none', createdAt: at(2, 3) },
    { status: 'disbursed', commissionStatus: 'paid', commission: 900, createdAt: at(2, 3) },
  ];
  const paid = [
    { commission: 100, commissionPaidAt: at(0, 1) },
    { commission: 50, commissionPaidAt: at(0, 1) },
    { commission: 200, commissionPaidAt: at(1, 20) },
    { commission: 400, commissionPaidAt: at(3, 10) },
    { commission: 25, commissionPaidAt: at(5, 1) },
  ];
  const finds = [];
  t.mock.method(Lead, 'countDocuments', async (f) => (f.status === 'approved' ? 1 : f.status === 'disbursed' ? 1 : f.status === 'rejected' ? 1 : 7));
  t.mock.method(Lead, 'find', (f) => { finds.push(f); return { select: async () => (f.commissionStatus === 'paid' ? paid : leads) }; });
  let statusFilter;
  t.mock.method(EmployeeStatus, 'find', (f) => { statusFilter = f; return chain([{ _id: 'sent1' }]); });

  const res = fakeRes();
  await ctrl.stats({ user: { _id: 'u1' } }, res);
  assert.equal(res.statusCode, 200);
  const b = res.body;
  assert.equal(b.needConsent, 3);
  assert.equal(b.approvalRate, 33); // 2 of 6 non-draft
  assert.deepEqual(b.trend, [25, 0, 400, 0, 200, 150]);
  assert.deepEqual(b.lastMonth, { earned: 200 });
  assert.deepEqual(b.thisMonth, { submitted: 2, approved: 1, paid: 2, earned: 150 });
  assert.equal(b.total, 7);
  assert.equal(b.active, 4);
  assert.equal(b.paidEarnings, 900);
  assert.equal(b.pendingEarnings, 70);
  // Six month window starts at the first of the month five months back (server-local, like monthStart).
  assert.deepEqual(finds[1].commissionPaidAt, { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) });
  assert.equal(statusFilter.statusType, 'whatsapp_consent');
  const rx = statusFilter.label.$regex;
  assert.ok(rx.test('Sent') && rx.test('SENT'));
  assert.ok(!rx.test('Consent Confirmed') && !rx.test('Consent Rejected'));
});

test('stats: approvalRate 0 with no submitted leads', async (t) => {
  t.mock.method(Lead, 'countDocuments', async () => 0);
  t.mock.method(Lead, 'find', () => ({ select: async () => [] }));
  t.mock.method(EmployeeStatus, 'find', () => chain([]));
  const res = fakeRes();
  await ctrl.stats({ user: { _id: 'u1' } }, res);
  assert.equal(res.body.approvalRate, 0);
  assert.equal(res.body.needConsent, 0);
  assert.deepEqual(res.body.trend, [0, 0, 0, 0, 0, 0]);
});

test('routes: /leaderboard is registered before GET /:id', () => {
  const router = require('../routes/lead.routes');
  const gets = router.stack.filter((l) => l.route && l.route.methods.get).map((l) => l.route.path);
  assert.ok(gets.indexOf('/leaderboard') >= 0);
  assert.ok(gets.indexOf('/leaderboard') < gets.indexOf('/:id'));
});
