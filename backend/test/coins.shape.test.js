const test = require('node:test'); const assert = require('node:assert/strict');
const { maskName, logoUrl, shapeRedemption } = require('../utils/coinsShape');
test('maskName', () => {
  assert.equal(maskName('Maya Sharma'), 'Maya S.');
  assert.equal(maskName('  maya   al khan '), 'maya K.');
  assert.equal(maskName('Maya'), 'Maya');
  assert.equal(maskName(''), '');
});
test('logoUrl', () => {
  assert.equal(logoUrl(null), null);
  assert.match(logoUrl('a.png'), /^https:\/\/.+\.s3\..+\.amazonaws\.com\/voucher-logos\/a\.png$/);
});
test('shapeRedemption', () => {
  const r = shapeRedemption({ _id: 1, code: 'X', coinCost: 5, createdAt: 'c', scratchedAt: null }, { _id: 2, logo: null }, 3);
  assert.deepEqual(Object.keys(r), ['_id', 'code', 'coinCost', 'createdAt', 'scratchedAt', 'voucher']);
  assert.equal(r.voucher.stock, 3);
  assert.equal(r.voucher.logoUrl, null);
});
test('balanceOf coalesces a missing coinBalance to 0', () => {
  const { balanceOf } = require('../utils/coinsShape');
  assert.equal(balanceOf({ coinBalance: 40 }), 40);
  assert.equal(balanceOf({ coinBalance: 0 }), 0);
  assert.equal(balanceOf({}), 0);
  assert.equal(balanceOf({ coinBalance: null }), 0);
  assert.equal(balanceOf(null), 0);
  assert.equal(balanceOf(undefined), 0);
});
