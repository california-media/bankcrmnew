// UAE PASS channel choices for one sign-in / link, read from the signed state (controllers/uaepass.controller.js).
// - The mobile app asks for the UAE PASS app on the same phone with ?on_device=1 (docs.uaepass.ae, Mobile
//   application guide: acr_values mobileondevice, app-to-app). Anything else gets the web login.
// - UAE PASS credentials are per channel (standard implementation guideline #18): app flows use the mobile
//   client once UAEPASS_MOBILE_CLIENT_ID and UAEPASS_MOBILE_CLIENT_SECRET are set, else the website client.
//   The choice is made once, at init, and kept in the signed state (`client: 'mobile'`), so the callback
//   exchanges the code with the client the authorize URL used even if the env changed in between.

const { isAllowedAppRedirect, isValidChallenge } = require('./appRedirect');

const ON_DEVICE_ACR = 'urn:digitalid:authentication:flow:mobileondevice';
const WEB_ACR = 'urn:safelayer:tws:policies:authentication:level:low';

// An app flow: an allowlisted app_redirect together with its PKCE challenge (same rule as the controller).
const isAppFlow = (payload) =>
  Boolean(payload) && isAllowedAppRedirect(payload.app_redirect) && isValidChallenge(payload.code_challenge);

// State fields for ?on_device=1; the caller adds them to app flows only.
function onDeviceStateOf(query) {
  return query && query.on_device === '1' ? { on_device: true } : {};
}

const hasMobileClient = (env) => Boolean(env.UAEPASS_MOBILE_CLIENT_ID && env.UAEPASS_MOBILE_CLIENT_SECRET);

// State fields recording the mobile client; the caller adds them to app flows only.
function appClientStateOf(env = process.env) {
  return hasMobileClient(env) ? { client: 'mobile' } : {};
}

const startedOnMobileClient = (payload) => isAppFlow(payload) && payload.client === 'mobile';

// The UAE PASS app login goes with the mobile client. Until UAE PASS issues it, UAEPASS_ON_DEVICE=1 turns it on
// for the website client too (to test); otherwise the app keeps the web login, as before this change.
function acrValuesFor(payload, env = process.env) {
  if (!isAppFlow(payload) || payload.on_device !== true) return WEB_ACR;
  return startedOnMobileClient(payload) || env.UAEPASS_ON_DEVICE === '1' ? ON_DEVICE_ACR : WEB_ACR;
}

// The client (and its registered redirect URI) for the authorize URL and the token call of one flow.
function clientFor(payload, env = process.env) {
  const web = {
    clientId: env.UAEPASS_CLIENT_ID || 'sandbox_stage',
    clientSecret: env.UAEPASS_CLIENT_SECRET || 'sandbox_stage',
    redirectUri: env.UAEPASS_REDIRECT_URI || 'http://localhost:8000/api/auth/uaepass/callback',
  };
  if (!startedOnMobileClient(payload) || !hasMobileClient(env)) return web;
  return {
    clientId: env.UAEPASS_MOBILE_CLIENT_ID,
    clientSecret: env.UAEPASS_MOBILE_CLIENT_SECRET,
    redirectUri: env.UAEPASS_MOBILE_REDIRECT_URI || web.redirectUri,
  };
}

module.exports = { ON_DEVICE_ACR, WEB_ACR, onDeviceStateOf, appClientStateOf, acrValuesFor, clientFor };
