const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../utils/coins');

test('validateInviteReward', () => {
  assert.equal(c.validateInviteReward(1000), null);
  assert.equal(c.validateInviteReward(0), null);
  const msg = 'Invite reward must be a whole number of coins';
  assert.equal(c.validateInviteReward(-1), msg);
  assert.equal(c.validateInviteReward(1.5), msg);
  assert.equal(c.validateInviteReward('abc'), msg);
  assert.equal(c.validateInviteReward(undefined), msg);
});

test('validateSpinSegments rejects weights below 0.01', () => {
  const segs = [{ coins: 1, weight: 0.005 }, ...c.DEFAULT_SEGMENTS.slice(1)];
  assert.match(c.validateSpinSegments(segs), /weight/i);
  const ok = [{ coins: 1, weight: 0.01 }, ...c.DEFAULT_SEGMENTS.slice(1)];
  assert.equal(c.validateSpinSegments(ok), null);
});
