const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const { resolveUaepassFields } = require('../utils/uaepassPrefill');

const SECRET = 'test-secret';
const MSG = 'UAE PASS session expired, please sign in with UAE PASS again';
const sign = (payload, opts = { expiresIn: '30m' }) => jwt.sign(payload, SECRET, opts);

test('valid prefill gives sub and emiratesId from token', () => {
  const t = sign({ sub: 'S1', emiratesId: '784-1', _uaepass: true });
  assert.deepStrictEqual(resolveUaepassFields({ uaepassPrefill: t }, SECRET), { uaepassSub: 'S1', emiratesId: '784-1' });
});
test('verified token emiratesId wins over a typed body value', () => {
  const t = sign({ sub: 'S1', emiratesId: '784-1', _uaepass: true });
  assert.strictEqual(resolveUaepassFields({ uaepassPrefill: t, emiratesId: '784-2' }, SECRET).emiratesId, '784-1');
});
test('typed body emiratesId is used when the token has none', () => {
  const t = sign({ sub: 'S1', _uaepass: true });
  assert.strictEqual(resolveUaepassFields({ uaepassPrefill: t, emiratesId: '784-2' }, SECRET).emiratesId, '784-2');
});
test('expired token errors', () => {
  const t = sign({ sub: 'S1', _uaepass: true }, { expiresIn: '-1s' });
  assert.deepStrictEqual(resolveUaepassFields({ uaepassPrefill: t }, SECRET), { error: MSG });
});
test('garbage token errors', () => {
  assert.deepStrictEqual(resolveUaepassFields({ uaepassPrefill: 'nope' }, SECRET), { error: MSG });
});
test('wrong secret errors', () => {
  const t = jwt.sign({ sub: 'S1', _uaepass: true }, 'other');
  assert.deepStrictEqual(resolveUaepassFields({ uaepassPrefill: t }, SECRET), { error: MSG });
});
test('token without _uaepass errors', () => {
  const t = sign({ sub: 'S1' });
  assert.deepStrictEqual(resolveUaepassFields({ uaepassPrefill: t }, SECRET), { error: MSG });
});
test('no prefill passes raw body through', () => {
  assert.deepStrictEqual(resolveUaepassFields({ uaepassSub: 'RAW', emiratesId: 'E' }, SECRET), { uaepassSub: 'RAW', emiratesId: 'E' });
});
