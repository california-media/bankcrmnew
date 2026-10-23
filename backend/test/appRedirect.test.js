const test = require('node:test');
const assert = require('node:assert');
const { isAllowedAppRedirect, safeWebOrigin, appRedirectUrl } = require('../utils/appRedirect');

// isAllowedAppRedirect
test('isAllowedAppRedirect: allowed scheme prefix passes', () => {
  assert.strictEqual(isAllowedAppRedirect('mysilah://uaepass', 'mysilah://'), true);
});
test('isAllowedAppRedirect: other scheme rejected', () => {
  assert.strictEqual(isAllowedAppRedirect('evil://x', 'mysilah://'), false);
});
test('isAllowedAppRedirect: empty / missing url rejected', () => {
  assert.strictEqual(isAllowedAppRedirect('', 'mysilah://'), false);
  assert.strictEqual(isAllowedAppRedirect(undefined, 'mysilah://'), false);
  assert.strictEqual(isAllowedAppRedirect(['mysilah://uaepass'], 'mysilah://'), false);
});
test('isAllowedAppRedirect: whitespace and CR/LF rejected', () => {
  assert.strictEqual(isAllowedAppRedirect('mysilah://uae pass', 'mysilah://'), false);
  assert.strictEqual(isAllowedAppRedirect('mysilah://uaepass\r\nLocation: https://evil.com', 'mysilah://'), false);
  assert.strictEqual(isAllowedAppRedirect('mysilah://uaepass\n', 'mysilah://'), false);
  assert.strictEqual(isAllowedAppRedirect('mysilah://uaepass\t', 'mysilah://'), false);
});
test('isAllowedAppRedirect: empty allowlist entries ignored (no match-everything)', () => {
  assert.strictEqual(isAllowedAppRedirect('evil://x', 'mysilah://, ,,'), false);
  assert.strictEqual(isAllowedAppRedirect('evil://x', ''), false);
  assert.strictEqual(isAllowedAppRedirect('evil://x', ' , '), false);
});
test('isAllowedAppRedirect: trimmed multi-entry allowlist', () => {
  assert.strictEqual(isAllowedAppRedirect('exp://192.168.1.5:8081/--/uaepass', 'mysilah:// , exp://192.168.1.5:8081/'), true);
});

// safeWebOrigin
test('safeWebOrigin: evil origin falls back to client origin', () => {
  assert.strictEqual(safeWebOrigin('https://evil.com/x', 'https://app.mysilah.ae'), 'https://app.mysilah.ae');
});
test('safeWebOrigin: client origin with path accepted', () => {
  assert.strictEqual(safeWebOrigin('https://app.mysilah.ae/login', 'https://app.mysilah.ae'), 'https://app.mysilah.ae');
});
test('safeWebOrigin: undefined candidate gives client origin', () => {
  assert.strictEqual(safeWebOrigin(undefined, 'https://app.mysilah.ae', ''), 'https://app.mysilah.ae');
});
test('safeWebOrigin: garbage candidate gives client origin', () => {
  assert.strictEqual(safeWebOrigin('not a url', 'https://app.mysilah.ae/', ''), 'https://app.mysilah.ae');
});
test('safeWebOrigin: extra allowlisted origin accepted', () => {
  assert.strictEqual(
    safeWebOrigin('https://staging.mysilah.ae/register', 'https://app.mysilah.ae', 'http://localhost:5173, https://staging.mysilah.ae'),
    'https://staging.mysilah.ae'
  );
});
test('safeWebOrigin: lookalike origin not accepted', () => {
  assert.strictEqual(safeWebOrigin('https://app.mysilah.ae.evil.com/', 'https://app.mysilah.ae', ''), 'https://app.mysilah.ae');
  assert.strictEqual(safeWebOrigin('http://app.mysilah.ae/', 'https://app.mysilah.ae', ''), 'https://app.mysilah.ae');
});
test('safeWebOrigin: garbage clientUrl falls back to localhost default', () => {
  assert.strictEqual(safeWebOrigin('https://evil.com', 'garbage', ''), 'http://localhost:5173');
  assert.strictEqual(safeWebOrigin(undefined, undefined, ''), 'http://localhost:5173');
});

// appRedirectUrl
test('appRedirectUrl: appends query with ?', () => {
  assert.strictEqual(appRedirectUrl('mysilah://uaepass', { code: 'ab' }), 'mysilah://uaepass?code=ab');
});
test('appRedirectUrl: appends with & when base already has ?', () => {
  assert.strictEqual(appRedirectUrl('mysilah://uaepass?from=login', { code: 'ab' }), 'mysilah://uaepass?from=login&code=ab');
});
test('appRedirectUrl: encodes values', () => {
  assert.strictEqual(appRedirectUrl('mysilah://uaepass', { uaepass_error: 'a&b=c' }), 'mysilah://uaepass?uaepass_error=a%26b%3Dc');
});
