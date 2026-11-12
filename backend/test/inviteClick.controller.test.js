const test = require('node:test');
const assert = require('node:assert/strict');
const { makeInviteClickController } = require('../controllers/inviteClick.controller');

const fakeRes = () => {
  const r = { statusCode: 200, body: undefined };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};

const NOW = new Date('2026-11-12T10:00:00Z').getTime();
const INVITER = { _id: 'agent1' };

// Fake models: record calls, return what each test sets.
function build({ inviter = INVITER, candidates = [], claims = null, env = {} } = {}) {
  const calls = { create: [], findUser: [], find: [], claim: [], retire: [] };
  const claimQueue = claims ? [...claims] : null;
  const User = {
    findOne: (q) => { calls.findUser.push(q); return { select: () => ({ lean: async () => inviter }) }; },
  };
  const InviteClick = {
    create: async (doc) => { calls.create.push(doc); return doc; },
    find: (q) => {
      calls.find.push(q);
      return { sort: () => ({ limit: () => ({ lean: async () => candidates }) }) };
    },
    findOneAndUpdate: (filter, update) => {
      calls.claim.push([filter, update]);
      const doc = claimQueue ? claimQueue.shift() : candidates.find((c) => c._id === filter._id);
      return { lean: async () => doc ?? null };
    },
    updateMany: async (filter, update) => { calls.retire.push([filter, update]); return {}; },
  };
  const ctrl = makeInviteClickController({ InviteClick, User, env, now: () => NOW });
  return { ctrl, calls };
}

const PUBLIC_IP = '94.200.1.2';
const tapBody = { code: 'ab12cd34', platform: 'ios', screenW: 390, screenH: 844, pixelRatio: 3, timezone: 'Asia/Dubai' };

test('click stores a tap for a valid code from a public IP', async () => {
  const { ctrl, calls } = build({ env: { IOS_APP_STORE_URL: 'https://apps.apple.com/app/id1' } });
  const res = fakeRes();
  await ctrl.click({ body: tapBody, ip: PUBLIC_IP }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { iosStoreUrl: 'https://apps.apple.com/app/id1', androidStoreUrl: null });
  assert.deepEqual(calls.findUser[0], { referralCode: 'AB12CD34', role: 'agent', isActive: true });
  assert.deepEqual(calls.create[0], {
    code: 'AB12CD34', inviter: 'agent1', ip: PUBLIC_IP, platform: 'ios',
    osVersion: null, screenW: 390, screenH: 844, pixelRatio: 3, timezone: 'Asia/Dubai',
  });
});

test('click with unknown code stores nothing', async () => {
  const { ctrl, calls } = build({ inviter: null, env: { ANDROID_PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=com.mysilah.app' } });
  const res = fakeRes();
  await ctrl.click({ body: tapBody, ip: PUBLIC_IP }, res);
  assert.equal(calls.create.length, 0);
  assert.deepEqual(res.body, { iosStoreUrl: null, androidStoreUrl: 'https://play.google.com/store/apps/details?id=com.mysilah.app' });
  // A junk code never reaches the database.
  const b = build();
  await b.ctrl.click({ body: { ...tapBody, code: 'xyz!!' }, ip: PUBLIC_IP }, fakeRes());
  assert.equal(b.calls.findUser.length, 0);
  assert.equal(b.calls.create.length, 0);
});

test('click from a private IP or a desktop stores nothing', async () => {
  let b = build();
  await b.ctrl.click({ body: tapBody, ip: '127.0.0.1' }, fakeRes());
  assert.equal(b.calls.create.length, 0);
  b = build();
  await b.ctrl.click({ body: { ...tapBody, platform: 'other' }, ip: PUBLIC_IP }, fakeRes());
  assert.equal(b.calls.create.length, 0);
});

const probe = { platform: 'ios', screenW: 390, screenH: 844, pixelRatio: 3, timezone: 'Asia/Dubai' };

test('match returns the claimed code', async () => {
  const { ctrl, calls } = build({ candidates: [{ _id: 'c1', code: 'AB12CD34', screenW: 390, screenH: 844 }] });
  const res = fakeRes();
  await ctrl.match({ body: probe, ip: '94.200.1.3' }, res);
  assert.deepEqual(res.body, { code: 'AB12CD34' });
  assert.deepEqual(calls.find[0], {
    ip: '94.200.1.3', platform: 'ios', claimedAt: null, createdAt: { $gte: new Date(NOW - 24 * 3600 * 1000) },
  });
  assert.deepEqual(calls.claim[0], [{ _id: 'c1', claimedAt: null }, { $set: { claimedAt: new Date(NOW) } }]);
});

test('match claims atomically', async () => {
  const c1 = { _id: 'c1', code: 'AAAA1111' };
  const c2 = { _id: 'c2', code: 'BBBB2222' };
  // c1 was claimed by another launch a moment ago: fall through to c2.
  let b = build({ candidates: [c1, c2], claims: [null, c2] });
  let res = fakeRes();
  await b.ctrl.match({ body: probe, ip: '94.200.1.4' }, res);
  assert.deepEqual(res.body, { code: 'BBBB2222' });
  assert.deepEqual(b.calls.claim.map(([f]) => f._id), ['c1', 'c2']);
  // Every claim lost: nothing.
  b = build({ candidates: [c1, c2], claims: [null, null] });
  res = fakeRes();
  await b.ctrl.match({ body: probe, ip: '94.200.1.5' }, res);
  assert.deepEqual(res.body, { code: null });
});

test('match from a private IP or platform other returns null without querying', async () => {
  let b = build({ candidates: [{ _id: 'c1', code: 'AB12CD34' }] });
  let res = fakeRes();
  await b.ctrl.match({ body: probe, ip: '10.0.0.2' }, res);
  assert.deepEqual(res.body, { code: null });
  assert.equal(b.calls.find.length, 0);
  b = build({ candidates: [{ _id: 'c1', code: 'AB12CD34' }] });
  res = fakeRes();
  await b.ctrl.match({ body: { ...probe, platform: 'web' }, ip: '94.200.1.6' }, res);
  assert.deepEqual(res.body, { code: null });
  assert.equal(b.calls.find.length, 0);
});

test('match is rate limited after 10 calls per IP', async () => {
  const { ctrl, calls } = build({ candidates: [] });
  for (let i = 0; i < 12; i++) await ctrl.match({ body: probe, ip: '94.200.1.7' }, fakeRes());
  assert.equal(calls.find.length, 10);
});

test('click is rate limited after 30 calls per IP but still answers', async () => {
  const { ctrl, calls } = build();
  let res;
  for (let i = 0; i < 32; i++) {
    res = fakeRes();
    await ctrl.click({ body: tapBody, ip: '94.200.1.8' }, res);
  }
  assert.equal(calls.create.length, 30);
  assert.deepEqual(res.body, { iosStoreUrl: null, androidStoreUrl: null });
});

test('click stores the IPv6 /64 network, and match finds it from another address in it', async () => {
  let b = build();
  await b.ctrl.click({ body: tapBody, ip: '2001:db8:1:2::aaaa' }, fakeRes());
  assert.equal(b.calls.create[0].ip, '2001:db8:1:2::/64');
  b = build({ candidates: [{ _id: 'c1', code: 'AB12CD34' }] });
  const res = fakeRes();
  await b.ctrl.match({ body: probe, ip: '2001:db8:1:2::bbbb' }, res);
  assert.equal(b.calls.find[0].ip, '2001:db8:1:2::/64');
  assert.deepEqual(res.body, { code: 'AB12CD34' });
});

test('a successful claim also retires duplicate taps of the same link from that network', async () => {
  const { ctrl, calls } = build({ candidates: [{ _id: 'c1', code: 'AB12CD34' }] });
  await ctrl.match({ body: probe, ip: '94.200.1.9' }, fakeRes());
  assert.deepEqual(calls.retire, [[
    { ip: '94.200.1.9', platform: 'ios', code: 'AB12CD34', claimedAt: null },
    { $set: { claimedAt: new Date(NOW) } },
  ]]);
});

test('rate limits share one bucket per IPv6 /64', async () => {
  const { ctrl, calls } = build({ candidates: [] });
  for (let i = 0; i < 12; i++) await ctrl.match({ body: probe, ip: `2001:db8:9:9::${i + 1}` }, fakeRes());
  assert.equal(calls.find.length, 10);
});

test('local testing switch: INVITE_MATCH_ALLOW_PRIVATE lets private addresses record and match', async () => {
  const env = { INVITE_MATCH_ALLOW_PRIVATE: 'true' };
  let b = build({ env });
  await b.ctrl.click({ body: tapBody, ip: '127.0.0.1' }, fakeRes());
  assert.equal(b.calls.create[0].ip, '127.0.0.1');
  b = build({ env, candidates: [{ _id: 'c1', code: 'AB12CD34' }] });
  const res = fakeRes();
  await b.ctrl.match({ body: probe, ip: '127.0.0.1' }, res);
  assert.deepEqual(res.body, { code: 'AB12CD34' });
  // Anything but exactly "true" keeps the guard on.
  b = build({ env: { INVITE_MATCH_ALLOW_PRIVATE: '1' } });
  await b.ctrl.click({ body: tapBody, ip: '127.0.0.1' }, fakeRes());
  assert.equal(b.calls.create.length, 0);
});
