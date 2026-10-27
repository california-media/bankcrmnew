const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'pkce-test-secret';
process.env.CLIENT_URL = 'https://app.mysilah.ae';
delete process.env.UAEPASS_APP_REDIRECTS;
delete process.env.UAEPASS_WEB_ORIGINS;

const { pkceChallengeOf, isValidChallenge, isValidVerifier, pkceMatches } = require('../utils/appRedirect');
const UaepassExchange = require('../models/UaepassExchange');
const User = require('../models/User');
const uaepass = require('../controllers/uaepass.controller');

// RFC 7636 Appendix B.
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const EXPIRED = { message: 'Sign-in link expired, please try again' };

// ── helpers ──────────────────────────────────────────────────────────────
test('pkceChallengeOf: RFC 7636 S256 example', () => {
  assert.equal(pkceChallengeOf(RFC_VERIFIER), RFC_CHALLENGE);
});
test('pkceChallengeOf: 43-char base64url without padding', () => {
  const c = pkceChallengeOf('a'.repeat(128));
  assert.equal(c.length, 43);
  assert.match(c, /^[A-Za-z0-9_-]{43}$/);
});

test('isValidChallenge: accepts the RFC challenge', () => {
  assert.equal(isValidChallenge(RFC_CHALLENGE), true);
});
test('isValidChallenge: rejects 42 and 44 characters', () => {
  assert.equal(isValidChallenge(RFC_CHALLENGE.slice(0, 42)), false);
  assert.equal(isValidChallenge(RFC_CHALLENGE + 'A'), false);
});
test('isValidChallenge: rejects non-base64url characters and padding', () => {
  assert.equal(isValidChallenge(RFC_CHALLENGE.slice(0, 42) + '+'), false);
  assert.equal(isValidChallenge(RFC_CHALLENGE.slice(0, 42) + '/'), false);
  assert.equal(isValidChallenge(RFC_CHALLENGE.slice(0, 42) + '='), false);
  assert.equal(isValidChallenge(RFC_CHALLENGE.slice(0, 42) + ' '), false);
});
test('isValidChallenge: rejects non-strings', () => {
  assert.equal(isValidChallenge(undefined), false);
  assert.equal(isValidChallenge(null), false);
  assert.equal(isValidChallenge([RFC_CHALLENGE]), false);
  assert.equal(isValidChallenge({ $ne: null }), false);
});

test('isValidVerifier: accepts RFC verifier and 43/128-char unreserved strings', () => {
  assert.equal(isValidVerifier(RFC_VERIFIER), true);
  assert.equal(isValidVerifier('A-._~'.repeat(8) + 'abc'), true); // 43
  assert.equal(isValidVerifier('z'.repeat(128)), true);
});
test('isValidVerifier: rejects 42 and 129 characters', () => {
  assert.equal(isValidVerifier('a'.repeat(42)), false);
  assert.equal(isValidVerifier('a'.repeat(129)), false);
});
test('isValidVerifier: rejects characters outside [A-Za-z0-9-._~]', () => {
  for (const ch of ['+', '/', '=', ' ', '\n', 'é', '%']) {
    assert.equal(isValidVerifier('a'.repeat(42) + ch), false, JSON.stringify(ch));
  }
});
test('isValidVerifier: rejects non-strings', () => {
  assert.equal(isValidVerifier(undefined), false);
  assert.equal(isValidVerifier(['a'.repeat(43)]), false);
  assert.equal(isValidVerifier({ $ne: null }), false);
});

test('pkceMatches: true only for the verifier that produced the challenge', () => {
  assert.equal(pkceMatches(RFC_VERIFIER, RFC_CHALLENGE), true);
  assert.equal(pkceMatches('b'.repeat(43), RFC_CHALLENGE), false);
  assert.equal(pkceMatches(RFC_VERIFIER, undefined), false);
  assert.equal(pkceMatches(RFC_VERIFIER, RFC_CHALLENGE.slice(0, 42)), false);
  assert.equal(pkceMatches('short', pkceChallengeOf('short')), false);
});

// ── model ────────────────────────────────────────────────────────────────
test('UaepassExchange: challenge required; exactly one of token / prefill', () => {
  const base = { code: 'c'.repeat(32), expiresAt: new Date(), challenge: RFC_CHALLENGE };
  assert.equal(new UaepassExchange({ ...base, token: 't' }).validateSync(), undefined);
  assert.equal(new UaepassExchange({ ...base, prefill: 'p' }).validateSync(), undefined);
  assert.ok(new UaepassExchange({ ...base, token: 't', prefill: 'p' }).validateSync());
  assert.ok(new UaepassExchange(base).validateSync());
  const noChallenge = new UaepassExchange({ code: 'c'.repeat(32), expiresAt: new Date(), token: 't' }).validateSync();
  assert.ok(noChallenge && noChallenge.errors.challenge);
});

// ── init / linkUrl ───────────────────────────────────────────────────────
const mkRes = () => ({
  statusCode: 200, body: undefined, url: undefined,
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
  redirect(u) { this.url = u; return this; },
});
const stateOf = (authUrl) => jwt.decode(new URL(authUrl).searchParams.get('state'));
const strip = ({ iat, exp, ...rest }) => rest;

test('init: app_redirect with a valid challenge is stored with the challenge', () => {
  const res = mkRes();
  uaepass.init({ headers: {}, query: { app_redirect: 'mysilah://uaepass', code_challenge: RFC_CHALLENGE } }, res);
  const s = stateOf(res.url);
  assert.equal(s.app_redirect, 'mysilah://uaepass');
  assert.equal(s.code_challenge, RFC_CHALLENGE);
});
test('init: app_redirect without a valid challenge is ignored (web state)', () => {
  const web = mkRes();
  uaepass.init({ headers: { referer: 'https://app.mysilah.ae/login' }, query: {} }, web);
  for (const code_challenge of [undefined, '', RFC_CHALLENGE.slice(0, 42), [RFC_CHALLENGE]]) {
    const res = mkRes();
    uaepass.init({ headers: { referer: 'https://app.mysilah.ae/login' }, query: { app_redirect: 'mysilah://uaepass', code_challenge } }, res);
    assert.deepEqual(strip(stateOf(res.url)), strip(stateOf(web.url)), JSON.stringify(code_challenge));
  }
});
test('init: a challenge without an allowed app_redirect is not stored', () => {
  const res = mkRes();
  uaepass.init({ headers: {}, query: { app_redirect: 'evil://x', code_challenge: RFC_CHALLENGE } }, res);
  const s = stateOf(res.url);
  assert.equal(s.app_redirect, undefined);
  assert.equal(s.code_challenge, undefined);
});
test('linkUrl: app_redirect kept only with a valid challenge', () => {
  const user = { _id: { toString: () => 'U1' } };
  const ok = mkRes();
  uaepass.linkUrl({ headers: {}, query: { app_redirect: 'mysilah://uaepass', code_challenge: RFC_CHALLENGE }, user }, ok);
  assert.equal(stateOf(ok.body.url).app_redirect, 'mysilah://uaepass');
  assert.equal(stateOf(ok.body.url).code_challenge, RFC_CHALLENGE);
  const bad = mkRes();
  uaepass.linkUrl({ headers: {}, query: { app_redirect: 'mysilah://uaepass' }, user }, bad);
  assert.equal(stateOf(bad.body.url).app_redirect, undefined);
  assert.equal(stateOf(bad.body.url).code_challenge, undefined);
});

// ── exchange ─────────────────────────────────────────────────────────────
// In-memory UaepassExchange.findOneAndDelete and User.findById (query-like thenable).
const CODE = 'ab'.repeat(16);
const setup = (t, { row, user }) => {
  const store = new Map(row ? [[row.code, row]] : []);
  const calls = { findOneAndDelete: 0 };
  t.mock.method(UaepassExchange, 'findOneAndDelete', async (q) => {
    calls.findOneAndDelete++;
    const d = typeof q.code === 'string' ? store.get(q.code) : null;
    if (!d || !(d.expiresAt > q.expiresAt.$gt)) return null;
    store.delete(q.code);
    return d;
  });
  t.mock.method(User, 'findById', (id) => {
    const found = user && String(id) === String(user._id) ? user : null;
    const query = { select: () => query, populate: () => query, then: (ok, ko) => Promise.resolve(found).then(ok, ko) };
    return query;
  });
  return { store, calls };
};
const loginRow = (overrides = {}) => ({
  code: CODE,
  token: jwt.sign({ id: 'U1' }, process.env.JWT_SECRET),
  challenge: RFC_CHALLENGE,
  expiresAt: new Date(Date.now() + 60000),
  ...overrides,
});
const activeUser = { _id: 'U1', name: 'Ali', email: 'ali@x.ae', phone: '9715', role: 'agent', isActive: true };
const exchange = async (body) => { const res = mkRes(); await uaepass.exchange({ body }, res); return res; };

test('exchange: correct verifier returns the login shape and consumes the code', async (t) => {
  const row = loginRow();
  setup(t, { row, user: activeUser });
  const r1 = await exchange({ code: CODE, code_verifier: RFC_VERIFIER });
  assert.equal(r1.statusCode, 200);
  assert.deepEqual(Object.keys(r1.body), ['token', 'user']);
  assert.equal(r1.body.token, row.token);
  assert.equal(r1.body.user.email, 'ali@x.ae');
  const r2 = await exchange({ code: CODE, code_verifier: RFC_VERIFIER });
  assert.equal(r2.statusCode, 400);
  assert.deepEqual(r2.body, EXPIRED);
});
test('exchange: wrong verifier gets the uniform 400 and still burns the code', async (t) => {
  const { store } = setup(t, { row: loginRow(), user: activeUser });
  const r1 = await exchange({ code: CODE, code_verifier: 'b'.repeat(43) });
  assert.equal(r1.statusCode, 400);
  assert.deepEqual(r1.body, EXPIRED);
  assert.equal(store.size, 0);
  const r2 = await exchange({ code: CODE, code_verifier: RFC_VERIFIER });
  assert.equal(r2.statusCode, 400);
  assert.deepEqual(r2.body, EXPIRED);
});
test('exchange: missing or malformed verifier gets the uniform 400', async (t) => {
  setup(t, { row: loginRow(), user: activeUser });
  for (const code_verifier of [undefined, '', 'a'.repeat(42), 'a'.repeat(129), RFC_VERIFIER + '+', { $ne: null }, [RFC_VERIFIER]]) {
    const r = await exchange({ code: CODE, code_verifier });
    assert.equal(r.statusCode, 400, JSON.stringify(code_verifier));
    assert.deepEqual(r.body, EXPIRED);
  }
});
test('exchange: row without a stored challenge never succeeds', async (t) => {
  setup(t, { row: loginRow({ challenge: undefined }), user: activeUser });
  const r = await exchange({ code: CODE, code_verifier: RFC_VERIFIER });
  assert.equal(r.statusCode, 400);
  assert.deepEqual(r.body, EXPIRED);
});
test('exchange: prefill row returns only { prefill }', async (t) => {
  setup(t, { row: loginRow({ token: undefined, prefill: 'PREFILL.JWT' }) });
  const r = await exchange({ code: CODE, code_verifier: RFC_VERIFIER });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(r.body, { prefill: 'PREFILL.JWT' });
});
test('exchange: inactive user gets 403 with the login message', async (t) => {
  setup(t, { row: loginRow(), user: { ...activeUser, isActive: false, registrationStatus: 'pending' } });
  const r = await exchange({ code: CODE, code_verifier: RFC_VERIFIER });
  assert.equal(r.statusCode, 403);
  assert.deepEqual(r.body, { message: 'Account pending admin approval.' });
});
test('exchange: missing user gets the uniform 400', async (t) => {
  setup(t, { row: loginRow(), user: null });
  const r = await exchange({ code: CODE, code_verifier: RFC_VERIFIER });
  assert.equal(r.statusCode, 400);
  assert.deepEqual(r.body, EXPIRED);
});
test('exchange: expired row gets the uniform 400', async (t) => {
  setup(t, { row: loginRow({ expiresAt: new Date(Date.now() - 1) }), user: activeUser });
  const r = await exchange({ code: CODE, code_verifier: RFC_VERIFIER });
  assert.equal(r.statusCode, 400);
  assert.deepEqual(r.body, EXPIRED);
});
