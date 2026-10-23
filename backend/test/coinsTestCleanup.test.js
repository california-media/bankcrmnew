const test = require('node:test');
const assert = require('node:assert');
const { parseArgs, assertSafePrefix, validateArgs } = require('../scripts/coinsTestCleanup');

test('parseArgs: snapshot mode with users split/trim/lowercase', () => {
  const a = parseArgs(['--snapshot', '--users= A@x.com , B@Y.com,,']);
  assert.strictEqual(a.mode, 'snapshot');
  assert.deepStrictEqual(a.users, ['a@x.com', 'b@y.com']);
  assert.strictEqual(a.dryRun, false);
  assert.strictEqual(a.force, false);
});
test('parseArgs: cleanup with prefix, dry-run, force', () => {
  const a = parseArgs(['--cleanup', '--users=a@x', '--voucher-prefix=[TEST]', '--dry-run', '--force']);
  assert.strictEqual(a.mode, 'cleanup');
  assert.strictEqual(a.voucherPrefix, '[TEST]');
  assert.strictEqual(a.dryRun, true);
  assert.strictEqual(a.force, true);
});
test('parseArgs: unknown arg and conflicting modes are errors', () => {
  assert.ok(parseArgs(['--bogus']).errors.length);
  assert.ok(parseArgs(['--snapshot', '--cleanup']).errors.length);
});
test('validateArgs: requires mode, users, and prefix for cleanup', () => {
  assert.ok(validateArgs(parseArgs([])).length);
  assert.ok(validateArgs(parseArgs(['--snapshot'])).length);
  assert.ok(validateArgs(parseArgs(['--cleanup', '--users=a@x'])).length);
  assert.deepStrictEqual(validateArgs(parseArgs(['--snapshot', '--users=a@x'])), []);
  assert.deepStrictEqual(validateArgs(parseArgs(['--cleanup', '--users=a@x', '--voucher-prefix=[TEST]'])), []);
});
test('assertSafePrefix: rejects empty/short, accepts [TEST]', () => {
  assert.throws(() => assertSafePrefix(''));
  assert.throws(() => assertSafePrefix('[T'));
  assert.throws(() => assertSafePrefix(undefined));
  assert.strictEqual(assertSafePrefix('[TEST]'), '[TEST]');
});
