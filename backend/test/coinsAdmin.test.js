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

test('validateSpinSegments / validateInviteReward cap values at 1,000,000', () => {
  const rest = c.DEFAULT_SEGMENTS.slice(1);
  assert.equal(c.validateSpinSegments([{ coins: 1000000, weight: 1000000 }, ...rest]), null);
  assert.equal(c.validateSpinSegments([{ coins: 1000001, weight: 1 }, ...rest]), 'Segment coins must be at most 1,000,000');
  assert.equal(c.validateSpinSegments([{ coins: 1, weight: 1000000.01 }, ...rest]), 'Segment weight must be at most 1,000,000');
  assert.equal(c.validateInviteReward(1000000), null);
  assert.equal(c.validateInviteReward(1000001), 'Invite reward must be at most 1,000,000 coins');
  // Worst case allowed draw stays far below crypto.randomInt's 2^48 range limit.
  let max = 0;
  c.pickSegmentIndex(Array.from({ length: 8 }, () => ({ coins: 1, weight: 999999.99 })), (n) => { max = n; return 0; });
  assert.ok(max > 0 && max < 2 ** 48);
});
