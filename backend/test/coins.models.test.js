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

test('User.coinBalance has no default: saving a loaded user without it never writes it', () => {
  const mongoose = require('mongoose');
  const User = require('../models/User');
  assert.equal(User.schema.path('coinBalance').defaultValue, undefined);
  // An existing user doc from before the coins feature (no coinBalance field).
  const u = User.hydrate({ _id: new mongoose.Types.ObjectId(), email: 'a@x.com', role: 'agent', name: 'A' });
  assert.equal(u.coinBalance, undefined);
  u.name = 'B';
  const [, delta] = u.$__delta(); // the update document save() would send
  assert.equal(delta.$set.name, 'B');
  assert.ok(!('coinBalance' in delta.$set), 'save must not $set coinBalance on a doc that lacks it');
  // A doc that already has a balance is not rewritten by an unrelated save either.
  const v = User.hydrate({ _id: new mongoose.Types.ObjectId(), email: 'b@x.com', role: 'agent', name: 'A', coinBalance: 40 });
  v.name = 'B';
  assert.ok(!('coinBalance' in v.$__delta()[1].$set));
  // New users are created without the field too; $inc creates it on first credit.
  assert.equal(new User({ email: 'c@x.com', role: 'agent' }).toObject().coinBalance, undefined);
});

test('Redemption.voucherCode is unique (one redemption per code)', () => {
  const idx = require('../models/Redemption').schema.indexes().find(([k]) => JSON.stringify(k) === '{"voucherCode":1}');
  assert.ok(idx, 'voucherCode index missing');
  assert.equal(idx[1].unique, true);
  assert.deepEqual(idx[1].partialFilterExpression, { voucherCode: { $type: 'objectId' } });
});
