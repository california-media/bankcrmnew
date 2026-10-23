const test = require('node:test'); const assert = require('node:assert/strict');
test('coin models declare the guard indexes', () => {
  const idx = (m) => require(`../models/${m}`).schema.indexes().map(([k, o]) => [JSON.stringify(k), !!o.unique]);
  assert.deepEqual(idx('SpinLog').find(([k]) => k === '{"user":1,"dayKey":1}'), ['{"user":1,"dayKey":1}', true]);
  assert.deepEqual(idx('VoucherCode').find(([k]) => k === '{"voucher":1,"code":1}'), ['{"voucher":1,"code":1}', true]);
  assert.ok(idx('CoinTransaction').some(([k, u]) => k === '{"invitee":1}' && u));
  const invIdx = require('../models/CoinTransaction').schema.indexes().find(([k]) => JSON.stringify(k) === '{"invitee":1}');
  assert.deepEqual(invIdx[1].partialFilterExpression, { type: 'invite' });
  assert.ok(require('../models/User').schema.path('coinBalance'));
  assert.ok(require('../models/Notification').schema.path('type').enumValues.includes('coins_awarded'));
});
