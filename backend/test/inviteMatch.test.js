const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCode, normalizeProbe, isPublicIp, pickInviteClick, networkKey } = require('../utils/inviteMatch');

test('normalizeCode: trims and uppercases a valid code, rejects junk', () => {
  assert.equal(normalizeCode(' ab12cd34 '), 'AB12CD34');
  assert.equal(normalizeCode('xyz!!'), null);
  assert.equal(normalizeCode(''), null);
  assert.equal(normalizeCode(undefined), null);
  assert.equal(normalizeCode('A'.repeat(17)), null);
});

test('normalizeProbe: cleans types, drops bad numbers, unknown platform is other', () => {
  assert.deepEqual(
    normalizeProbe({ platform: 'iOS', screenW: '390', screenH: -1, pixelRatio: 3, timezone: 'Asia/Dubai' }),
    { platform: 'ios', osVersion: null, screenW: 390, screenH: null, pixelRatio: 3, timezone: 'Asia/Dubai' },
  );
  assert.equal(normalizeProbe({ platform: 'windows' }).platform, 'other');
  assert.equal(normalizeProbe(undefined).platform, 'other');
  assert.equal(normalizeProbe({ osVersion: 'x'.repeat(60) }).osVersion.length, 40);
});

test('isPublicIp: public v4 and mapped v4 yes; loopback, private, empty no', () => {
  assert.equal(isPublicIp('94.200.1.2'), true);
  assert.equal(isPublicIp('::ffff:94.200.1.2'), true);
  for (const ip of ['127.0.0.1', '::1', '10.0.0.5', '172.20.1.1', '192.168.1.4', '::ffff:10.0.0.5', '169.254.1.1', '100.64.0.1', 'fd00::1', 'fe80::1', '', undefined]) {
    assert.equal(isPublicIp(ip), false, String(ip));
  }
});

test('pickInviteClick: rotated screen still matches', () => {
  const click = { code: 'A', screenW: 844, screenH: 390 };
  assert.equal(pickInviteClick([click], { platform: 'ios', screenW: 390, screenH: 844 }), click);
});

test('pickInviteClick: same IP, two devices', () => {
  const a = { code: 'A', screenW: 390, screenH: 844, pixelRatio: 3 };
  const b = { code: 'B', screenW: 430, screenH: 932, pixelRatio: 3 };
  assert.equal(pickInviteClick([a, b], { platform: 'ios', screenW: 430, screenH: 932, pixelRatio: 3 }), b);
  assert.equal(pickInviteClick([a, b], { platform: 'ios', screenW: 375, screenH: 667 }), null);
  assert.equal(pickInviteClick([a, b], { platform: 'ios' }), a);
});

test('pickInviteClick: android os major must match, ios ignores os', () => {
  const android = { code: 'A', osVersion: '14' };
  assert.equal(pickInviteClick([android], { platform: 'android', osVersion: '14.0.1' }), android);
  assert.equal(pickInviteClick([android], { platform: 'android', osVersion: '13' }), null);
  const ios = { code: 'I', osVersion: '18.6' };
  assert.equal(pickInviteClick([ios], { platform: 'ios', osVersion: '26.1' }), ios);
});

test('pickInviteClick: timezone mismatch rejects, pixel ratio must be close', () => {
  assert.equal(pickInviteClick([{ code: 'A', timezone: 'Asia/Dubai' }], { platform: 'ios', timezone: 'Europe/London' }), null);
  assert.equal(pickInviteClick([{ code: 'A', pixelRatio: 2 }], { platform: 'ios', pixelRatio: 3 }), null);
  const near = { code: 'A', pixelRatio: 2.625 };
  assert.equal(pickInviteClick([near], { platform: 'android', pixelRatio: 2.63 }), near);
});

test('pickInviteClick: frozen Chrome Android "10" never blocks a match', () => {
  // Chrome 110+ reports "Android 10; K" whatever the real version is.
  const chrome = { code: 'A', osVersion: '10' };
  assert.equal(pickInviteClick([chrome], { platform: 'android', osVersion: '14' }), chrome);
});

test('networkKey: IPv4 as is, IPv6 by its /64 network (privacy addresses change within it)', () => {
  assert.equal(networkKey('94.200.1.2'), '94.200.1.2');
  assert.equal(networkKey('::ffff:94.200.1.2'), '94.200.1.2');
  assert.equal(networkKey('2001:db8:1:2::aaaa'), '2001:db8:1:2::/64');
  assert.equal(networkKey('2001:0DB8:0001:0002:0:0:0:bbbb'), '2001:db8:1:2::/64');
  assert.equal(networkKey('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(networkKey(''), '');
});
