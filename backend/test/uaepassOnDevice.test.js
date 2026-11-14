// The mobile app's app-to-app sign-in (controllers/uaepass.controller.js with utils/uaepassChannel.js).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const uaepass = require('../controllers/uaepass.controller');

const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const APP_QUERY = { app_redirect: 'mysilah://uaepass?flow=abc', code_challenge: CHALLENGE };
const ON_DEVICE = 'urn:digitalid:authentication:flow:mobileondevice';
const WEB = 'urn:safelayer:tws:policies:authentication:level:low';

function withMobileClient(fn) {
  return async () => {
    process.env.UAEPASS_MOBILE_CLIENT_ID = 'mob_id';
    process.env.UAEPASS_MOBILE_CLIENT_SECRET = 'mob_secret';
    try {
      await fn();
    } finally {
      delete process.env.UAEPASS_MOBILE_CLIENT_ID;
      delete process.env.UAEPASS_MOBILE_CLIENT_SECRET;
    }
  };
}

function initRedirect(query) {
  let location = null;
  uaepass.init({ query, headers: {} }, { redirect: (url) => (location = url) });
  return new URL(location);
}

const stateOf = (url) => jwt.verify(url.searchParams.get('state'), process.env.JWT_SECRET);

test('init: the app asking for the UAE PASS app gets mobileondevice and keeps on_device in the state', withMobileClient(() => {
  const url = initRedirect({ ...APP_QUERY, on_device: '1' });
  assert.strictEqual(url.searchParams.get('acr_values'), ON_DEVICE);
  assert.strictEqual(stateOf(url).on_device, true);
}));

test('init: before the mobile client is configured, the app keeps the web login', () => {
  const url = initRedirect({ ...APP_QUERY, on_device: '1' });
  assert.strictEqual(url.searchParams.get('acr_values'), WEB);
});

test('init: without on_device the app keeps the web login', () => {
  const url = initRedirect(APP_QUERY);
  assert.strictEqual(url.searchParams.get('acr_values'), WEB);
  assert.strictEqual(stateOf(url).on_device, undefined);
});

test('init: the website (no app state) ignores on_device', () => {
  const url = initRedirect({ on_device: '1' });
  assert.strictEqual(url.searchParams.get('acr_values'), WEB);
  assert.strictEqual(stateOf(url).on_device, undefined);
});

test('init: app flows use the mobile client once it is configured; the website keeps its own', withMobileClient(() => {
  assert.strictEqual(initRedirect(APP_QUERY).searchParams.get('client_id'), 'mob_id');
  assert.notStrictEqual(initRedirect({}).searchParams.get('client_id'), 'mob_id');
}));

test('init: the chosen client rides in the signed state', withMobileClient(() => {
  assert.strictEqual(stateOf(initRedirect(APP_QUERY)).client, 'mobile');
  assert.strictEqual(stateOf(initRedirect({})).client, undefined);
}));

test('link-url: on_device for the app', withMobileClient(() => {
  let body = null;
  uaepass.linkUrl(
    { query: { ...APP_QUERY, on_device: '1' }, headers: {}, user: { _id: 'u1' } },
    { json: (b) => (body = b), status: () => ({ json: (b) => (body = b) }) },
  );
  assert.strictEqual(new URL(body.url).searchParams.get('acr_values'), ON_DEVICE);
}));

test('callback: the code is exchanged with the client the flow started with', withMobileClient(async () => {
  const state = jwt.sign({ ctx: 'uaepass', ...APP_QUERY, client: 'mobile', on_device: true }, process.env.JWT_SECRET);
  const realFetch = global.fetch;
  let seen = null;
  global.fetch = async (req) => {
    seen = { auth: req.headers.get('authorization'), form: await req.formData() };
    return new Response('nope', { status: 400 });
  };
  let location = null;
  try {
    await uaepass.callback({ query: { code: 'c0de', state }, headers: {} }, { redirect: (url) => (location = url) });
  } finally {
    global.fetch = realFetch;
  }
  assert.strictEqual(seen.auth, `Basic ${Buffer.from('mob_id:mob_secret').toString('base64')}`);
  assert.ok(seen.form.get('redirect_uri'));
  assert.strictEqual(location, 'mysilah://uaepass?flow=abc&uaepass_error=token_failed');
}));

test('callback: a flow started before the mobile client was configured is exchanged with the website client', withMobileClient(async () => {
  const state = jwt.sign({ ctx: 'uaepass', ...APP_QUERY }, process.env.JWT_SECRET);
  const realFetch = global.fetch;
  let auth = null;
  global.fetch = async (req) => {
    auth = req.headers.get('authorization');
    return new Response('nope', { status: 400 });
  };
  try {
    await uaepass.callback({ query: { code: 'c0de', state }, headers: {} }, { redirect: () => undefined });
  } finally {
    global.fetch = realFetch;
  }
  assert.notStrictEqual(auth, `Basic ${Buffer.from('mob_id:mob_secret').toString('base64')}`);
}));
