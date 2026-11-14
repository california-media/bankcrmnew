const test = require('node:test');
const assert = require('node:assert');
const { ON_DEVICE_ACR, WEB_ACR, onDeviceStateOf, appClientStateOf, acrValuesFor, clientFor } = require('../utils/uaepassChannel');

const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const APP = { ctx: 'uaepass', app_redirect: 'mysilah://uaepass?flow=abc', code_challenge: CHALLENGE };
// An app flow started while the mobile client was configured (init stored the choice in the signed state).
const APP_MOBILE = { ...APP, client: 'mobile' };
const WEB = { ctx: 'uaepass', frontendUrl: 'https://app.mysilah.ae' };

const WEB_ENV = {
  UAEPASS_CLIENT_ID: 'web_id',
  UAEPASS_CLIENT_SECRET: 'web_secret',
  UAEPASS_REDIRECT_URI: 'https://api.example/api/auth/uaepass/callback',
};
const MOBILE_ENV = { ...WEB_ENV, UAEPASS_MOBILE_CLIENT_ID: 'mob_id', UAEPASS_MOBILE_CLIENT_SECRET: 'mob_secret' };
const WEB_CLIENT = { clientId: 'web_id', clientSecret: 'web_secret', redirectUri: WEB_ENV.UAEPASS_REDIRECT_URI };

test('acr values are the ones UAE PASS documents', () => {
  assert.strictEqual(ON_DEVICE_ACR, 'urn:digitalid:authentication:flow:mobileondevice');
  assert.strictEqual(WEB_ACR, 'urn:safelayer:tws:policies:authentication:level:low');
});

test('onDeviceStateOf: only on_device=1 asks for the UAE PASS app', () => {
  assert.deepStrictEqual(onDeviceStateOf({ on_device: '1' }), { on_device: true });
  assert.deepStrictEqual(onDeviceStateOf({ on_device: 'true' }), {});
  assert.deepStrictEqual(onDeviceStateOf({ on_device: ['1'] }), {});
  assert.deepStrictEqual(onDeviceStateOf({}), {});
  assert.deepStrictEqual(onDeviceStateOf(undefined), {});
});

test('appClientStateOf: the app flow records the mobile client only when its id and secret are set', () => {
  assert.deepStrictEqual(appClientStateOf(MOBILE_ENV), { client: 'mobile' });
  assert.deepStrictEqual(appClientStateOf(WEB_ENV), {});
  assert.deepStrictEqual(appClientStateOf({ ...WEB_ENV, UAEPASS_MOBILE_CLIENT_ID: 'mob_id' }), {});
});

test('acrValuesFor: the app flow asking for the UAE PASS app gets mobileondevice with the mobile client', () => {
  assert.strictEqual(acrValuesFor({ ...APP_MOBILE, on_device: true }, MOBILE_ENV), ON_DEVICE_ACR);
});

test('acrValuesFor: on the website client, mobileondevice only when UAEPASS_ON_DEVICE=1 says so', () => {
  assert.strictEqual(acrValuesFor({ ...APP, on_device: true }, WEB_ENV), WEB_ACR);
  assert.strictEqual(acrValuesFor({ ...APP, on_device: true }, MOBILE_ENV), WEB_ACR);
  assert.strictEqual(acrValuesFor({ ...APP, on_device: true }, { ...WEB_ENV, UAEPASS_ON_DEVICE: '1' }), ON_DEVICE_ACR);
  assert.strictEqual(acrValuesFor({ ...APP, on_device: true }, { ...WEB_ENV, UAEPASS_ON_DEVICE: 'true' }), WEB_ACR);
});

test('acrValuesFor: web login otherwise (no on_device, website, forged or broken app state)', () => {
  assert.strictEqual(acrValuesFor(APP_MOBILE, MOBILE_ENV), WEB_ACR);
  assert.strictEqual(acrValuesFor({ ...WEB, client: 'mobile', on_device: true }, MOBILE_ENV), WEB_ACR);
  assert.strictEqual(acrValuesFor({ ...APP_MOBILE, app_redirect: 'evil://x', on_device: true }, MOBILE_ENV), WEB_ACR);
  assert.strictEqual(acrValuesFor({ ...APP_MOBILE, code_challenge: 'short', on_device: true }, MOBILE_ENV), WEB_ACR);
  assert.strictEqual(acrValuesFor(null, MOBILE_ENV), WEB_ACR);
});

test('clientFor: an app flow started with the mobile client keeps it', () => {
  assert.deepStrictEqual(clientFor(APP_MOBILE, MOBILE_ENV), {
    clientId: 'mob_id',
    clientSecret: 'mob_secret',
    redirectUri: WEB_ENV.UAEPASS_REDIRECT_URI,
  });
  assert.deepStrictEqual(clientFor(APP_MOBILE, { ...MOBILE_ENV, UAEPASS_MOBILE_REDIRECT_URI: 'https://api.example/m' }), {
    clientId: 'mob_id',
    clientSecret: 'mob_secret',
    redirectUri: 'https://api.example/m',
  });
});

test('clientFor: website client for the website, and for the app until the mobile client is complete', () => {
  assert.deepStrictEqual(clientFor(WEB, MOBILE_ENV), WEB_CLIENT);
  assert.deepStrictEqual(clientFor(APP, WEB_ENV), WEB_CLIENT);
  assert.deepStrictEqual(clientFor({ ...APP_MOBILE, app_redirect: 'evil://x' }, MOBILE_ENV), WEB_CLIENT);
});

test('clientFor: a flow keeps the client it started with when the env changes before its callback', () => {
  // Started on the website client, mobile client configured since (a deploy inside the state's 10 minutes).
  assert.deepStrictEqual(clientFor(APP, MOBILE_ENV), WEB_CLIENT);
  // Started on the mobile client, which was then removed: nothing to exchange with but the website client.
  assert.deepStrictEqual(clientFor(APP_MOBILE, WEB_ENV), WEB_CLIENT);
});

test('clientFor: same defaults as before when nothing is configured', () => {
  assert.deepStrictEqual(clientFor(WEB, {}), {
    clientId: 'sandbox_stage',
    clientSecret: 'sandbox_stage',
    redirectUri: 'http://localhost:8000/api/auth/uaepass/callback',
  });
});
