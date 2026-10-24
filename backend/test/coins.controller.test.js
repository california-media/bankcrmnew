const test = require('node:test');
const assert = require('node:assert/strict');
const Voucher = require('../models/Voucher');
const VoucherCode = require('../models/VoucherCode');
const ctrl = require('../controllers/coins.controller');

// Model statics are stubbed per test (t.mock.method restores them); no DB is touched.
const fakeRes = () => {
  const r = { statusCode: 200, body: undefined };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};

test('GET /coins/vouchers lists only active vouchers still inside their validUntil Dubai day', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-23T10:00:00Z') });
  let filter;
  t.mock.method(Voucher, 'find', (f) => { filter = f; return { sort: () => ({ lean: async () => [] }) }; });
  t.mock.method(VoucherCode, 'aggregate', async () => []);
  const res = fakeRes();
  await ctrl.vouchers({ user: { _id: 'u1' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(filter, {
    isActive: true,
    $or: [{ validUntil: null }, { validUntil: { $gte: new Date('2026-10-22T20:00:00.000Z') } }],
  });
});

const CoinTransaction = require('../models/CoinTransaction');
const Redemption = require('../models/Redemption');
const OID = '6a1b2c3d4e5f60718293a4b5';

test('GET /coins/transactions caps a huge page at 100000 instead of overflowing skip', async (t) => {
  let skipped;
  const chain = { sort: () => chain, skip: (n) => { skipped = n; return chain; }, limit: () => chain, lean: async () => [] };
  t.mock.method(CoinTransaction, 'find', () => chain);
  const res = fakeRes();
  await ctrl.transactions({ user: { _id: 'u1' }, query: { page: '100000000000000000000' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(skipped, (100000 - 1) * 20);
  assert.equal(res.body.page, 100000);
  const res2 = fakeRes();
  await ctrl.transactions({ user: { _id: 'u1' }, query: { page: '3' } }, res2);
  assert.equal(skipped, 40);
  assert.equal(res2.body.page, 3);
});

test('POST /coins/redemptions/:id/scratch -> 404 (not 500) when the row vanishes mid-request', async (t) => {
  t.mock.method(Redemption, 'findOne', async () => ({ _id: OID }));
  t.mock.method(Redemption, 'updateOne', async () => ({}));
  t.mock.method(Redemption, 'findById', () => ({ select: () => ({ lean: async () => null }) }));
  const res = fakeRes();
  await ctrl.scratch({ user: { _id: 'u1' }, params: { id: OID } }, res);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { message: 'Redemption not found' });
});
