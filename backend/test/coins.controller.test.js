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
