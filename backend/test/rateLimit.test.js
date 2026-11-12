const test = require('node:test');
const assert = require('node:assert/strict');
const { makeRateLimiter } = require('../utils/rateLimit');

test('rate limiter: allows max hits per window, then again after it', () => {
  let t = 0;
  const rl = makeRateLimiter({ windowMs: 1000, max: 2, now: () => t });
  assert.deepEqual([rl.hit('a'), rl.hit('a'), rl.hit('a')], [false, false, true]);
  assert.equal(rl.hit('b'), false);
  t = 1001;
  assert.equal(rl.hit('a'), false);
});

test('rate limiter: forgets keys whose hits are all older than the window', () => {
  let t = 0;
  const rl = makeRateLimiter({ windowMs: 1000, max: 5, now: () => t });
  rl.hit('a');
  rl.hit('b');
  assert.equal(rl.size(), 2);
  t = 2000;
  rl.hit('c');
  assert.equal(rl.size(), 1);
});
