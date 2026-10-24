const test = require('node:test');
const assert = require('node:assert/strict');
const { makeCoinsService } = require('../services/coins.service');
const { voucherValidFilter } = require('../utils/coins');

const SEGS = [
  { coins: 5, weight: 30 }, { coins: 10, weight: 30 }, { coins: 20, weight: 20 },
  { coins: 50, weight: 6 }, { coins: 10, weight: 10 }, { coins: 100, weight: 4 },
];
const NOW = new Date('2026-10-23T10:00:00Z');

function build(o = {}) {
  const calls = { voucherFind: [], userUpdate: [], codeClaim: [], codeUpdate: [], txCreate: [], txUpdate: [], txDelete: [], spinCreate: [], spinDelete: [], redemptionCreate: [], redemptionFind: [], notify: [] };
  const rows = o.redemptions ? o.redemptions.map((r) => ({ ...r })) : []; // Redemption collection
  let codes = o.codes === undefined ? [{ _id: 'c1', code: 'ABC', status: 'available' }] : o.codes;
  let balance = o.balance === undefined ? 1000 : o.balance;
  const deps = {
    now: () => NOW,
    randInt: o.randInt || (() => 0),
    CoinSettings: { getSingleton: async () => ({ spinEnabled: true, spinSegments: SEGS, inviteEnabled: true, inviteReward: 1000, ...(o.settings || {}) }) },
    Voucher: {
      findOne: async (f) => {
        calls.voucherFind.push(f);
        const v = o.voucher === undefined ? { _id: 'v1', title: 'Cafe', coinCost: 100, isActive: true } : o.voucher;
        if (!v || !f.$or) return v;
        // Evaluate the validity $or the way Mongo would: null/missing, or validUntil >= bound.
        const ok = f.$or.some((cond) => (cond.validUntil === null ? v.validUntil == null : v.validUntil >= cond.validUntil.$gte));
        return ok ? v : null;
      },
    },
    VoucherCode: {
      findOneAndUpdate: async (f, u) => {
        calls.codeClaim.push([f, u]);
        const c = codes.find((x) => x.status === 'available'); // sync: atomic claim
        if (!c) return null;
        c.status = 'assigned';
        return { ...c };
      },
      updateOne: async (f, u) => { calls.codeUpdate.push([f, u]); return {}; },
    },
    User: {
      findOneAndUpdate: async (f, u) => {
        calls.userUpdate.push([f, u]);
        if (o.userNull) return null;
        const d = u.$inc.coinBalance;
        if (f.coinBalance && balance < f.coinBalance.$gte) return null;
        if (o.refundThrows && d > 0) throw new Error('refund down');
        if (o.userThrows) throw new Error('db down');
        balance += d;
        if (o.noBalanceField) return { _id: f._id }; // doc without the field: reads must coalesce to 0
        return { _id: f._id, coinBalance: balance };
      },
      findOne: async () => (o.inviter === undefined ? { _id: 'inv1' } : o.inviter),
    },
    SpinLog: {
      create: async (d) => { calls.spinCreate.push(d); if (o.spinDup) throw Object.assign(new Error('dup'), { code: 11000 }); return { _id: 'log1', ...d }; },
      deleteOne: async (f) => { calls.spinDelete.push(f); },
    },
    Redemption: {
      create: async (d) => {
        calls.redemptionCreate.push(d);
        // Unique index on voucherCode.
        if (rows.some((r) => r.voucherCode === d.voucherCode)) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
        if (o.redemptionThrows === 'after-insert') { rows.push({ _id: 'r9', ...d }); throw new Error('socket closed'); }
        if (o.redemptionThrows) throw new Error('boom');
        const r = { _id: 'r1', ...d };
        rows.push(r);
        return r;
      },
      findOne: async (f) => {
        calls.redemptionFind.push(f);
        if (o.findThrows) throw new Error('find down');
        return rows.find((r) => Object.entries(f).every(([k, v]) => r[k] === v)) || null;
      },
    },
    CoinTransaction: {
      count: 0,
      create: async function (d) {
        calls.txCreate.push(d);
        if (o.txDup || (o.txDupAfterFirst && calls.txCreate.length > 1)) throw Object.assign(new Error('dup'), { code: 11000 });
        return { _id: 't' + calls.txCreate.length, ...d };
      },
      updateOne: async (f, u) => { calls.txUpdate.push([f, u]); },
      deleteOne: async (f) => { calls.txDelete.push(f); },
    },
    notify: async (...a) => { calls.notify.push(a); if (o.notifyThrows) throw new Error('smtp'); },
  };
  return { svc: makeCoinsService(deps), calls, getBalance: () => balance, getCodes: () => codes };
}

test('redeem: happy path claims code, debits, writes redemption + tx', async () => {
  const { svc, calls } = build();
  const res = await svc.redeem('u1', 'v1');
  assert.equal(res.balance, 900);
  assert.equal(res.redemption.code, 'ABC');
  assert.equal(calls.txCreate[0].amount, -100);
  assert.equal(calls.txCreate[0].balanceAfter, 900);
  assert.equal(calls.txCreate[0].type, 'redeem');
  assert.deepEqual(calls.userUpdate[0][0], { _id: 'u1', role: 'agent', coinBalance: { $gte: 100 } });
  assert.deepEqual(calls.codeUpdate.at(-1), [{ _id: 'c1' }, { $set: { redemption: 'r1' } }]);
});

test('redeem: missing or inactive voucher -> 404', async () => {
  const { svc } = build({ voucher: null });
  await assert.rejects(svc.redeem('u1', 'v1'), { status: 404, message: 'Voucher not found' });
});

test('redeem: voucher lookup filters active and unexpired', async () => {
  const { svc, calls } = build();
  await svc.redeem('u1', 'v1');
  assert.deepEqual(calls.voucherFind[0], { _id: 'v1', isActive: true, ...voucherValidFilter(NOW) });
});

test('redeem: voucher past its validUntil Dubai day -> 404, nothing claimed or charged', async () => {
  // NOW is 2026-10-23 14:00 Dubai; validUntil 2026-10-22 ended at 2026-10-22T20:00Z.
  const { svc, calls, getBalance } = build({ voucher: { _id: 'v1', title: 'Cafe', coinCost: 100, isActive: true, validUntil: new Date('2026-10-22') } });
  await assert.rejects(svc.redeem('u1', 'v1'), { status: 404, message: 'Voucher not found' });
  assert.equal(calls.codeClaim.length, 0);
  assert.equal(calls.userUpdate.length, 0);
  assert.equal(getBalance(), 1000);
});

test('redeem: voucher on its last valid Dubai day still redeems', async () => {
  const { svc } = build({ voucher: { _id: 'v1', title: 'Cafe', coinCost: 100, isActive: true, validUntil: new Date('2026-10-23') } });
  const res = await svc.redeem('u1', 'v1');
  assert.equal(res.balance, 900);
});

test('redeem: out of stock leaves balance untouched', async () => {
  const { svc, calls, getBalance } = build({ codes: [] });
  await assert.rejects(svc.redeem('u1', 'v1'), { status: 409, message: 'Out of stock' });
  assert.equal(calls.userUpdate.length, 0);
  assert.equal(getBalance(), 1000);
});

test('redeem: not enough coins releases the code', async () => {
  const { svc, calls } = build({ balance: 50 });
  await assert.rejects(svc.redeem('u1', 'v1'), { status: 400, message: 'Not enough coins' });
  const [f, u] = calls.codeUpdate[0];
  // Scoped release: only the code this request claimed, still held by this user and not yet linked.
  assert.deepEqual(f, { _id: 'c1', status: 'assigned', assignedTo: 'u1', redemption: null });
  assert.equal(u.$set.status, 'available');
  assert.deepEqual(u.$unset, { assignedTo: 1, assignedAt: 1 });
  assert.equal(calls.redemptionCreate.length, 0);
});

test('redeem: second concurrent redeem fails without charging', async () => {
  const { svc, calls, getBalance } = build();
  const results = await Promise.allSettled([svc.redeem('u1', 'v1'), svc.redeem('u1', 'v1')]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const rej = results.find((r) => r.status === 'rejected');
  assert.equal(rej.reason.status, 409);
  assert.equal(calls.userUpdate.length, 1);
  assert.equal(getBalance(), 900);
});

test('redeem: debit throws -> code stays held, no release', async () => {
  const { svc, calls } = build({ userThrows: true });
  await assert.rejects(svc.redeem('u1', 'v1'), { message: 'db down' });
  assert.equal(calls.codeUpdate.length, 0);
});

test('redeem: create throws but our row exists -> success with the full row, no refund/release', async () => {
  const { svc, calls, getBalance } = build({ redemptionThrows: 'after-insert' });
  const res = await svc.redeem('u1', 'v1');
  assert.deepEqual(calls.redemptionFind[0], { voucherCode: 'c1', user: 'u1' }); // user-scoped lookup
  // The controller shapes the response from these fields; an {_id}-only row lost code/voucher/cost.
  assert.equal(res.redemption._id, 'r9');
  assert.equal(res.redemption.code, 'ABC');
  assert.equal(res.redemption.voucher, 'v1');
  assert.equal(res.redemption.coinCost, 100);
  assert.equal(res.balance, 900);
  assert.equal(getBalance(), 900);
  assert.equal(calls.userUpdate.length, 1);
  assert.ok(!calls.codeUpdate.some(([, u]) => u.$set && u.$set.status === 'available'));
  assert.deepEqual(calls.codeUpdate.at(-1), [{ _id: 'c1' }, { $set: { redemption: 'r9' } }]);
});

test('redeem: duplicate voucherCode owned by another user is never our success -> refund, code kept out of the pool', async () => {
  const foreign = { _id: 'rX', user: 'u2', voucher: 'v1', voucherCode: 'c1', code: 'ABC', coinCost: 100 };
  const { svc, calls, getBalance } = build({ redemptions: [foreign] });
  await assert.rejects(svc.redeem('u1', 'v1'), { code: 11000 });
  assert.deepEqual(calls.redemptionFind[0], { voucherCode: 'c1', user: 'u1' });
  assert.equal(getBalance(), 1000); // charged then refunded
  assert.equal(calls.userUpdate.length, 2);
  assert.equal(calls.txCreate.length, 0); // no ledger row, no back-link
  // The code already backs u2's redemption: releasing it would only make the next redeemer fail the same way.
  assert.equal(calls.codeUpdate.length, 0);
});

test('redeem: create throws and no row -> refund then release', async () => {
  const { svc, calls, getBalance } = build({ redemptionThrows: true });
  await assert.rejects(svc.redeem('u1', 'v1'), { message: 'boom' });
  assert.equal(getBalance(), 1000);
  assert.equal(calls.userUpdate.length, 2);
  assert.deepEqual(calls.codeUpdate[0][0], { _id: 'c1', status: 'assigned', assignedTo: 'u1', redemption: null });
  assert.equal(calls.codeUpdate[0][1].$set.status, 'available');
});

test('redeem: create throws, no row, refund throws -> no release', async () => {
  const { svc, calls } = build({ redemptionThrows: true, refundThrows: true });
  await assert.rejects(svc.redeem('u1', 'v1'), { message: 'boom' });
  assert.equal(calls.codeUpdate.length, 0);
});

test('redeem: create throws and existence check throws -> no compensation', async () => {
  const { svc, calls, getBalance } = build({ redemptionThrows: true, findThrows: true });
  await assert.rejects(svc.redeem('u1', 'v1'), { message: 'boom' });
  assert.equal(getBalance(), 900);
  assert.equal(calls.codeUpdate.length, 0);
});

test('spin: disabled -> 400', async () => {
  const { svc, calls } = build({ settings: { spinEnabled: false } });
  await assert.rejects(svc.spin('u1'), { status: 400, message: 'Spin & Win is not available right now' });
  assert.equal(calls.spinCreate.length, 0);
});

test('spin: duplicate day -> 409 and no credit', async () => {
  const { svc, calls } = build({ spinDup: true });
  await assert.rejects(svc.spin('u1'), { status: 409, message: "You've already spun today" });
  assert.equal(calls.userUpdate.length, 0);
});

test('spin: success credits segment coins and writes tx', async () => {
  const { svc, calls } = build({ randInt: () => 99 }); // weights sum 100; 99 -> index 5 (100 coins)
  const res = await svc.spin('u1');
  assert.equal(res.segmentIndex, 5);
  assert.equal(res.coins, SEGS[5].coins);
  assert.equal(res.balance, 1100);
  assert.equal(calls.spinCreate[0].dayKey, '2026-10-23');
  assert.equal(calls.txCreate[0].type, 'spin');
  assert.equal(calls.txCreate[0].spin, 'log1');
  assert.equal(calls.txCreate[0].title, 'Daily spin');
});

test('spin: credit throws -> SpinLog NOT deleted, error propagates', async () => {
  const { svc, calls } = build({ userThrows: true });
  await assert.rejects(svc.spin('u1'), { message: 'db down' });
  assert.equal(calls.spinDelete.length, 0);
});

test('spin: user definitively missing -> log removed, 404', async () => {
  const { svc, calls } = build({ userNull: true });
  await assert.rejects(svc.spin('u1'), { status: 404 });
  assert.deepEqual(calls.spinDelete, [{ _id: 'log1' }]);
});

const invitee = { _id: 'i1', name: '  Sara Ali ', referredBy: 'inv1' };

test('awardInvite: credits once, idempotent on second call', async () => {
  const { svc, calls } = build({ txDupAfterFirst: true });
  await svc.awardInvite(invitee);
  await svc.awardInvite(invitee);
  assert.equal(calls.userUpdate.length, 1);
  assert.equal(calls.notify.length, 1);
  assert.equal(calls.txCreate[0].title, 'Invite bonus · Sara');
  assert.equal(calls.txCreate[0].amount, 1000);
  assert.deepEqual(calls.txUpdate[0], [{ _id: 't1' }, { $set: { balanceAfter: 2000 } }]);
  assert.equal(calls.notify[0][1].body, 'You earned 1000 coins: Sara joined with your invite');
  assert.equal(calls.notify[0][1].noCoordinatorCopy, true);
});

test('awardInvite: skips inactive inviter / disabled / no referrer / zero reward', async () => {
  let b = build({ inviter: null });
  await b.svc.awardInvite(invitee);
  assert.equal(b.calls.txCreate.length, 0);
  b = build({ settings: { inviteEnabled: false } });
  await b.svc.awardInvite(invitee);
  assert.equal(b.calls.txCreate.length, 0);
  b = build();
  await b.svc.awardInvite({ ...invitee, referredBy: undefined });
  assert.equal(b.calls.txCreate.length, 0);
  b = build({ settings: { inviteReward: 0 } });
  await b.svc.awardInvite(invitee);
  assert.equal(b.calls.txCreate.length, 0);
});

test('awardInvite: never throws (notify failure, db failure) and falls back on empty name', async () => {
  let b = build({ notifyThrows: true });
  await b.svc.awardInvite({ ...invitee, name: '   ' });
  assert.equal(b.calls.txCreate[0].title, 'Invite bonus · a partner');
  b = build({ userThrows: true });
  await b.svc.awardInvite(invitee); // does not throw
  assert.equal(b.calls.txDelete.length, 0); // $inc may have applied: guard row kept
  b = build({ userNull: true });
  await b.svc.awardInvite(invitee);
  assert.deepEqual(b.calls.txDelete, [{ _id: 't1' }]); // definitively not credited: retry may pay
});

test('spin/redeem/invite: a returned user doc without coinBalance reads as 0, never undefined', async () => {
  let b = build({ noBalanceField: true });
  const spun = await b.svc.spin('u1');
  assert.equal(spun.balance, 0);
  assert.equal(b.calls.txCreate[0].balanceAfter, 0);
  b = build({ noBalanceField: true });
  const red = await b.svc.redeem('u1', 'v1');
  assert.equal(red.balance, 0);
  assert.equal(b.calls.txCreate[0].balanceAfter, 0);
  b = build({ noBalanceField: true });
  await b.svc.awardInvite(invitee);
  assert.deepEqual(b.calls.txUpdate[0], [{ _id: 't1' }, { $set: { balanceAfter: 0 } }]);
});
