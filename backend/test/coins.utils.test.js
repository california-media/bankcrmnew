const test = require('node:test'); const assert = require('node:assert/strict');
const c = require('../utils/coins');
test('dubaiDayKey: 19:59:59Z and 20:00:00Z fall on different Dubai days', () => {
  assert.equal(c.dubaiDayKey(new Date('2026-10-23T19:59:59Z')), '2026-10-23');
  assert.equal(c.dubaiDayKey(new Date('2026-10-23T20:00:00Z')), '2026-10-24');
});
test('nextDubaiMidnight', () => {
  assert.equal(c.nextDubaiMidnight(new Date('2026-10-23T10:00:00Z')).toISOString(), '2026-10-23T20:00:00.000Z');
  assert.equal(c.nextDubaiMidnight(new Date('2026-10-23T20:00:00Z')).toISOString(), '2026-10-24T20:00:00.000Z');
});
test('validateSpinSegments', () => {
  assert.equal(c.validateSpinSegments(c.DEFAULT_SEGMENTS), null);
  assert.match(c.validateSpinSegments(c.DEFAULT_SEGMENTS.slice(0, 3)), /4 to 8/);
  assert.match(c.validateSpinSegments([...c.DEFAULT_SEGMENTS, ...c.DEFAULT_SEGMENTS]), /4 to 8/);
  assert.match(c.validateSpinSegments(c.DEFAULT_SEGMENTS.map((s) => ({ ...s, weight: 0 }))), /weight/i);
  assert.match(c.validateSpinSegments([{ coins: -1, weight: 1 }, ...c.DEFAULT_SEGMENTS.slice(1)]), /coins/i);
  assert.match(c.validateSpinSegments([{ coins: 1.5, weight: 1 }, ...c.DEFAULT_SEGMENTS.slice(1)]), /coins/i);
});
test('pickSegmentIndex maps the random draw onto cumulative weights', () => {
  const segs = [{ coins: 5, weight: 30 }, { coins: 10, weight: 70 }];
  assert.equal(c.pickSegmentIndex(segs, () => 0), 0);
  assert.equal(c.pickSegmentIndex(segs, () => 29), 0);
  assert.equal(c.pickSegmentIndex(segs, () => 30), 1);
  assert.equal(c.pickSegmentIndex(segs, () => 99), 1);
});
test('chancePcts', () => assert.deepEqual(c.chancePcts(c.DEFAULT_SEGMENTS), [30, 30, 20, 6, 10, 4]));
test('parseVoucherCodes', () => {
  assert.deepEqual(c.parseVoucherCodes(' A1 \n\nB2\r\nA1\n' + 'x'.repeat(65)), ['A1', 'B2']);
});
