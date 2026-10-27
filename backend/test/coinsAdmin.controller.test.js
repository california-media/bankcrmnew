const test = require('node:test');
const assert = require('node:assert/strict');
const Voucher = require('../models/Voucher');
const VoucherCode = require('../models/VoucherCode');
const CoinSettings = require('../models/CoinSettings');
const ctrl = require('../controllers/coinsAdmin.controller');

// Model statics are stubbed per test (t.mock.method restores them); no DB is touched.
const fakeRes = () => {
  const r = { statusCode: 200, body: undefined };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};
const OID = '6a1b2c3d4e5f60718293a4b5';

function stubDelete(t, assignedSeq) {
  const calls = { deleteMany: [], updateOne: [], deleted: false };
  t.mock.method(Voucher, 'findById', async () => ({ _id: OID, logo: null, deleteOne: async () => { calls.deleted = true; } }));
  let i = 0;
  t.mock.method(VoucherCode, 'exists', async () => (assignedSeq[i++] ? { _id: 'c1' } : null));
  t.mock.method(VoucherCode, 'deleteMany', async (f) => { calls.deleteMany.push(f); return { deletedCount: 1 }; });
  t.mock.method(Voucher, 'updateOne', async (f, u) => { calls.updateOne.push([f, u]); return {}; });
  return calls;
}

test('DELETE voucher: deletes only available codes, then the voucher', async (t) => {
  const calls = stubDelete(t, [false, false]);
  const res = fakeRes();
  await ctrl.deleteVoucher({ params: { id: OID } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(calls.deleteMany, [{ voucher: OID, status: 'available' }]);
  assert.equal(calls.deleted, true);
  assert.equal(calls.updateOne.length, 0);
});

test('DELETE voucher: already redeemed -> 409, nothing deleted', async (t) => {
  const calls = stubDelete(t, [true]);
  const res = fakeRes();
  await ctrl.deleteVoucher({ params: { id: OID } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(calls.deleteMany.length, 0);
  assert.equal(calls.deleted, false);
});

test('DELETE voucher: a code redeemed during the delete -> voucher deactivated, 409, not deleted', async (t) => {
  const calls = stubDelete(t, [false, true]);
  const res = fakeRes();
  await ctrl.deleteVoucher({ params: { id: OID } }, res);
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /deactivated/i);
  assert.deepEqual(calls.deleteMany, [{ voucher: OID, status: 'available' }]); // the assigned code survives
  assert.deepEqual(calls.updateOne, [[{ _id: OID }, { $set: { isActive: false } }]]);
  assert.equal(calls.deleted, false);
});

test('PUT settings: values above 1,000,000 are rejected with 400 before saving', async (t) => {
  const get = t.mock.method(CoinSettings, 'getSingleton', async () => { throw new Error('must not load'); });
  const segs = [{ coins: 5, weight: 30 }, { coins: 10, weight: 30 }, { coins: 20, weight: 20 }, { coins: 50, weight: 20 }];
  const cases = [
    { spinSegments: [{ coins: 1000001, weight: 1 }, ...segs.slice(1)], inviteReward: 1000 },
    { spinSegments: [{ coins: 1, weight: 1000001 }, ...segs.slice(1)], inviteReward: 1000 },
    { spinSegments: segs, inviteReward: 1000001 },
  ];
  for (const body of cases) {
    const res = fakeRes();
    await ctrl.updateSettings({ body, user: { _id: 'a1' } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /1,000,000/);
  }
  assert.equal(get.mock.callCount(), 0);
});
