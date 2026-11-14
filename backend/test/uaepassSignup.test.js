const test = require('node:test');
const assert = require('node:assert/strict');
const { accountStateOf, signupPrefill } = require('../utils/uaepassSignup');

const PROFILE = { name: 'Sara Ali', phone: '971501234567', emiratesId: '784-1', nationality: 'ARE', sub: 'S1' };

test('accountStateOf: only ?account=super_agent goes into the signed state', () => {
  assert.deepEqual(accountStateOf({ account: 'super_agent' }), { account: 'super_agent' });
  assert.deepEqual(accountStateOf({ account: 'agency' }), {});
  assert.deepEqual(accountStateOf({ account: ['super_agent'] }), {});
  assert.deepEqual(accountStateOf({}), {});
  assert.deepEqual(accountStateOf(undefined), {});
});

test('signupPrefill: an agent sign-up with an email is created directly (no prefill)', () => {
  assert.equal(signupPrefill({}, { ...PROFILE, email: 'a@b.ae' }), null);
  assert.equal(signupPrefill(null, { ...PROFILE, email: 'a@b.ae' }), null);
});

test('signupPrefill: an agent sign-up without an email gets the register prefill (unchanged claims)', () => {
  assert.deepEqual(signupPrefill({}, { ...PROFILE, email: null }), { ...PROFILE, _uaepass: true });
});

test('signupPrefill: a super agent sign-up always gets a prefill, carrying the email when UAE PASS gave one', () => {
  const state = { account: 'super_agent' };
  assert.deepEqual(signupPrefill(state, { ...PROFILE, email: 'a@b.ae' }), {
    ...PROFILE, email: 'a@b.ae', account: 'super_agent', _uaepass: true,
  });
  assert.deepEqual(signupPrefill(state, { ...PROFILE, email: null }), { ...PROFILE, account: 'super_agent', _uaepass: true });
});
