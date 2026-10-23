const test = require('node:test');
const assert = require('node:assert');
const { parseArgs, assertSafePrefix, validateArgs } = require('../scripts/coinsTestCleanup');

test('parseArgs: snapshot mode with users split/trim/lowercase', () => {
  const a = parseArgs(['--snapshot', '--users= A@x.com , B@Y.com,,']);
  assert.strictEqual(a.mode, 'snapshot');
  assert.deepStrictEqual(a.users, ['a@x.com', 'b@y.com']);
  assert.strictEqual(a.dryRun, false);
  assert.strictEqual(a.force, false);
});
test('parseArgs: cleanup with prefix, dry-run, force', () => {
  const a = parseArgs(['--cleanup', '--users=a@x', '--voucher-prefix=[TEST]', '--dry-run', '--force']);
  assert.strictEqual(a.mode, 'cleanup');
  assert.strictEqual(a.voucherPrefix, '[TEST]');
  assert.strictEqual(a.dryRun, true);
  assert.strictEqual(a.force, true);
});
test('parseArgs: unknown arg and conflicting modes are errors', () => {
  assert.ok(parseArgs(['--bogus']).errors.length);
  assert.ok(parseArgs(['--snapshot', '--cleanup']).errors.length);
});
test('validateArgs: requires mode, users, and prefix for cleanup', () => {
  assert.ok(validateArgs(parseArgs([])).length);
  assert.ok(validateArgs(parseArgs(['--snapshot'])).length);
  assert.ok(validateArgs(parseArgs(['--cleanup', '--users=a@x'])).length);
  assert.deepStrictEqual(validateArgs(parseArgs(['--snapshot', '--users=a@x'])), []);
  assert.deepStrictEqual(validateArgs(parseArgs(['--cleanup', '--users=a@x', '--voucher-prefix=[TEST]'])), []);
});
test('assertSafePrefix: rejects empty/short, accepts [TEST]', () => {
  assert.throws(() => assertSafePrefix(''));
  assert.throws(() => assertSafePrefix('[T'));
  assert.throws(() => assertSafePrefix(undefined));
  assert.strictEqual(assertSafePrefix('[TEST]'), '[TEST]');
});

// ---- runCleanup with fake models ----
const { runCleanup } = require('../scripts/coinsTestCleanup');

function makeFakes({ foreign = [] } = {}) {
  const writes = [];
  const calls = [];
  const U1 = { _id: 'u1', email: 'a@x.com', coinBalance: 50 };
  const q = (rows) => ({ select: async () => rows });
  const del = (name) => async (f) => { writes.push([name, 'deleteMany', f]); return { deletedCount: 1 }; };
  const models = {
    User: {
      find: (f) => { calls.push(['User.find', f]); return q(f._id ? [{ _id: 'x', email: 'other@x.com' }] : [U1]); },
      updateOne: async (f, u) => { writes.push(['User', 'updateOne', f, u]); },
    },
    Voucher: { find: (f) => { calls.push(['Voucher.find', f]); return q([{ _id: 'v1', title: '[TEST] c' }]); }, deleteMany: del('Voucher') },
    Redemption: {
      find: (f) => { calls.push(['Redemption.find', f]); return q(f.user.$nin ? foreign : [{ _id: 'r1' }]); },
      deleteMany: del('Redemption'),
    },
    VoucherCode: { countDocuments: async () => 3, deleteMany: del('VoucherCode') },
    CoinTransaction: { countDocuments: async () => 2, deleteMany: del('CoinTransaction') },
    SpinLog: { countDocuments: async () => 1, deleteMany: del('SpinLog') },
    CoinSettings: { getSingleton: async () => ({ save: async () => { writes.push(['CoinSettings', 'save']); } }) },
  };
  return { models, writes, calls };
}
const SNAP = {
  takenAt: '2026-01-01T00:00:00.000Z',
  settings: { spinEnabled: false, spinSegments: [], inviteEnabled: false, inviteReward: 1000 },
  users: [{ email: 'a@x.com', _id: 'u1', coinBalance: 10 }],
};
const ARGS = { users: ['a@x.com'], voucherPrefix: '[TEST]', dryRun: false };

test('runCleanup: unlisted redeemer aborts before any write', async () => {
  const f = makeFakes({ foreign: [{ _id: 'r9', user: 'x', coinCost: 10, createdAt: new Date() }] });
  await assert.rejects(runCleanup({ models: f.models, snap: SNAP, args: ARGS, log: () => {} }), /non-listed/);
  assert.strictEqual(f.writes.length, 0);
});
test('runCleanup: every delete/update is id-scoped', async () => {
  const f = makeFakes();
  await runCleanup({ models: f.models, snap: SNAP, args: ARGS, log: () => {} });
  const by = (n) => f.writes.find((w) => w[0] === n && w[1] === 'deleteMany')[2];
  assert.deepStrictEqual(by('Voucher'), { _id: { $in: ['v1'] } });
  assert.deepStrictEqual(by('VoucherCode'), { voucher: { $in: ['v1'] } });
  assert.deepStrictEqual(by('Redemption').user, { $in: ['u1'] });
  assert.deepStrictEqual(by('Redemption').voucher, { $in: ['v1'] });
  const txs = f.writes.filter((w) => w[0] === 'CoinTransaction').map((w) => w[2]);
  assert.strictEqual(txs.length, 2);
  for (const t of txs) assert.deepStrictEqual(t.user, { $in: ['u1'] });
  assert.deepStrictEqual(txs[0].redemption, { $in: ['r1'] });
  assert.ok(txs[1].createdAt.$gte instanceof Date);
  assert.deepStrictEqual(by('SpinLog').user, { $in: ['u1'] });
  const upd = f.writes.find((w) => w[0] === 'User');
  assert.deepStrictEqual(upd.slice(2), [{ _id: 'u1' }, { $set: { coinBalance: 10 } }]);
  const vq = f.calls.find((c) => c[0] === 'Voucher.find')[1];
  assert.ok(vq.createdAt.$gte instanceof Date);
});
test('runCleanup: dry-run performs zero writes', async () => {
  const f = makeFakes();
  await runCleanup({ models: f.models, snap: SNAP, args: { ...ARGS, dryRun: true }, log: () => {} });
  assert.strictEqual(f.writes.length, 0);
});
test('runCleanup: snapshot _id mismatch aborts', async () => {
  const f = makeFakes();
  const snap = { ...SNAP, users: [{ email: 'a@x.com', _id: 'zzz', coinBalance: 10 }] };
  await assert.rejects(runCleanup({ models: f.models, snap, args: ARGS, log: () => {} }), /mismatch/);
  assert.strictEqual(f.writes.length, 0);
});
