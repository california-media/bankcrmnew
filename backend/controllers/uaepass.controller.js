const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UaepassExchange = require('../models/UaepassExchange');
const { signAuthToken, generateReferralCode } = require('../utils/token');
const { inactiveMessage, DEACTIVATED_MESSAGE } = require('../utils/superAgent');
const {
  isAllowedAppRedirect,
  safeWebOrigin,
  appRedirectUrl,
  isValidChallenge,
  isValidVerifier,
  pkceMatches,
} = require('../utils/appRedirect');
const { sanitize, safeUser } = require('./auth.controller');

const IS_STAGING   = process.env.UAEPASS_ENV !== 'production';
const BASE_URL     = IS_STAGING ? 'https://id.uaepass.ae/idshub' : 'https://id.uaepass.ae/idshub';
const CLIENT_ID    = process.env.UAEPASS_CLIENT_ID     || 'sandbox_stage';
const CLIENT_SECRET= process.env.UAEPASS_CLIENT_SECRET || 'sandbox_stage';
const REDIRECT_URI = process.env.UAEPASS_REDIRECT_URI  || 'http://localhost:8000/api/auth/uaepass/callback';
const FRONTEND_URL = process.env.CLIENT_URL             || 'http://localhost:5173';

const EXCHANGE_TTL_MS  = 120 * 1000;
const EXCHANGE_EXPIRED = 'Sign-in link expired, please try again';

const buildAuthUrl = (state) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: 'urn:uae:digitalid:profile:general urn:uae:digitalid:profile',
    redirect_uri: REDIRECT_URI,
    state,
    acr_values: 'urn:safelayer:tws:policies:authentication:level:low',
  });
  return `${BASE_URL}/authorize?${params.toString()}`;
};

// Only CLIENT_URL's origin (or one listed in UAEPASS_WEB_ORIGINS) may receive the token.
const getFrontendUrl = (req) =>
  safeWebOrigin(req.headers.referer || req.headers.referrer || req.headers.origin, FRONTEND_URL);

// App fields for the signed state: ?app_redirect= (must match UAEPASS_APP_REDIRECTS) together
// with its PKCE ?code_challenge= (S256). Without a valid challenge the app_redirect is ignored,
// so the request runs the web flow. Returns {} for the web flow.
const getAppState = (req) => {
  const { app_redirect: target, code_challenge: challenge } = req.query;
  if (!isAllowedAppRedirect(target) || !isValidChallenge(challenge)) return {};
  return { app_redirect: target, code_challenge: challenge };
};

// app_redirect from a verified (signed) state payload, re-checked against the allowlist.
// Never an app redirect without a PKCE challenge in the same state.
const appRedirectOf = (payload) => {
  const target = payload && payload.app_redirect;
  return isAllowedAppRedirect(target) && isValidChallenge(payload.code_challenge) ? target : null;
};

const getReturnPage = (req) => {
  try {
    const referer = req.headers.referer || req.headers.referrer || '';
    const path = new URL(referer).pathname;
    if (path.includes('login')) return 'login';
  } catch {}
  return 'register';
};

/**
 * GET /api/auth/uaepass/init
 * Redirects to UAE Pass authorization page (login / new-user flow).
 */
exports.init = (req, res) => {
  const frontendUrl = getFrontendUrl(req);
  const returnPage  = getReturnPage(req);
  const payload = { ctx: 'uaepass', frontendUrl, returnPage, ...getAppState(req) };
  const state = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10m' });
  res.redirect(buildAuthUrl(state));
};

/**
 * GET /api/auth/uaepass/link-init  (protected — must be logged in)
 * Starts UAE Pass OAuth to link to the current authenticated account.
 * Covers scenarios 1.1.2, 1.1.3, 1.2.2, 1.2.3 (manual linking).
 */
exports.linkInit = (req, res) => {
  const frontendUrl = getFrontendUrl(req);
  const state = jwt.sign(
    { ctx: 'uaepass', action: 'link', userId: req.user._id.toString(), frontendUrl },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
  res.redirect(buildAuthUrl(state));
};

/**
 * GET /api/auth/uaepass/link-url  (protected)
 * Same as link-init but returns { url } as JSON, so the mobile app can open it.
 * ?app_redirect= (allowlisted) + ?code_challenge= (PKCE S256) send the result back to the app.
 */
exports.linkUrl = (req, res) => {
  try {
    const payload = {
      ctx: 'uaepass',
      action: 'link',
      userId: req.user._id.toString(),
      frontendUrl: getFrontendUrl(req),
      ...getAppState(req),
    };
    const state = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10m' });
    res.json({ url: buildAuthUrl(state) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/auth/uaepass/exchange  (public)
 * Body { code, code_verifier }. Swaps the single-use code from the app redirect for
 * the login response { token, user }, or { prefill } for a new user without email.
 * code_verifier must hash (S256) to the code_challenge the app sent to init / link-url.
 */
exports.exchange = async (req, res) => {
  try {
    const { code, code_verifier: verifier } = req.body || {};
    if (typeof code !== 'string' || !/^[0-9a-f]{32}$/.test(code) || !isValidVerifier(verifier)) {
      return res.status(400).json({ message: EXCHANGE_EXPIRED });
    }
    // Consume first: a wrong verifier still burns the code, so verifiers can't be brute-forced.
    const entry = await UaepassExchange.findOneAndDelete({ code, expiresAt: { $gt: new Date() } });
    if (!entry || !pkceMatches(verifier, entry.challenge)) {
      return res.status(400).json({ message: EXCHANGE_EXPIRED });
    }

    if (!entry.token) {
      if (!entry.prefill) return res.status(400).json({ message: EXCHANGE_EXPIRED });
      return res.json({ prefill: entry.prefill });
    }

    let decoded;
    try {
      decoded = jwt.verify(entry.token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: EXCHANGE_EXPIRED });
    }
    const user = await User.findById(decoded.id);
    if (!user) return res.status(400).json({ message: EXCHANGE_EXPIRED });
    if (!user.isActive) return res.status(403).json({ message: inactiveMessage(user) });
    const full = await safeUser(user._id);
    if (!full) return res.status(400).json({ message: EXCHANGE_EXPIRED });
    res.json({ token: entry.token, user: sanitize(full) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/auth/uaepass/unlink  (protected)
 * Removes UAE Pass link from the authenticated account.
 * Requires the account to have a password set so login is still possible.
 */
exports.unlink = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.uaepassSub) return res.status(400).json({ message: 'UAE Pass not linked to this account' });
    if (!user.password) {
      return res.status(400).json({
        message: 'Set a password before unlinking UAE Pass — otherwise you will be locked out',
      });
    }
    await User.findByIdAndUpdate(user._id, { $unset: { uaepassSub: '' } });
    res.json({ success: true });
  } catch (err) {
    console.error('[UAE Pass unlink]', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/auth/uaepass/callback
 * Handles redirect from UAE Pass.
 * Detects login vs manual-link flow via the signed state payload.
 *
 * Auto-link priority (login flow): uaepassSub → email → emiratesId
 */
exports.callback = async (req, res) => {
  const { code, state, error, error_description } = req.query;

  // Every outcome goes through finish(): when the verified state carries an
  // allowlisted app_redirect, the app gets appRedirectUrl(app_redirect, appParams);
  // otherwise the website gets webUrl, exactly as before.
  const finish = (payload, webUrl, appParams) => {
    const appRedirect = appRedirectOf(payload);
    return res.redirect(appRedirect ? appRedirectUrl(appRedirect, appParams) : webUrl);
  };

  // Outcomes carrying a secret (login token / register prefill): the website gets webUrl
  // (unchanged, secret in the URL); the app gets only a single-use code. The secret stays
  // server-side, bound to the state's PKCE challenge, until POST /uaepass/exchange.
  const finishWithExchange = async (payload, secret, webUrl) => {
    if (appRedirectOf(payload)) {
      const exchangeCode = crypto.randomBytes(16).toString('hex');
      await UaepassExchange.create({
        code: exchangeCode,
        ...secret,
        challenge: payload.code_challenge,
        expiresAt: new Date(Date.now() + EXCHANGE_TTL_MS),
      });
      return finish(payload, null, { code: exchangeCode });
    }
    return finish(payload, webUrl, null);
  };

  // Resolve origin + returnPage from state even on error.
  // payload is only set when the state verifies, so an unsigned app_redirect is never used.
  const resolveState = (s) => {
    try {
      const payload = jwt.verify(s, process.env.JWT_SECRET);
      return {
        origin: payload.frontendUrl ? safeWebOrigin(payload.frontendUrl, FRONTEND_URL) : FRONTEND_URL,
        returnPage: payload.returnPage || 'register',
        payload,
      };
    } catch { return { origin: FRONTEND_URL, returnPage: 'register', payload: null }; }
  };
  const { origin: errorOrigin, returnPage: errorReturnPage, payload: verifiedState } = state
    ? resolveState(state)
    : { origin: FRONTEND_URL, returnPage: 'register', payload: null };

  if (error) {
    console.log('[UAE Pass callback] error:', error, '| error_description:', error_description, '| all params:', JSON.stringify(req.query));
    let frontendError = error;
    if (error === 'cancelledOnApp') {
      const desc = (error_description || '').toLowerCase();
      if (desc.includes('web') || (desc.includes('cancel') && desc.includes('web'))) {
        frontendError = 'cancelledOnWeb';
      }
    }
    return finish(
      verifiedState,
      `${errorOrigin}/${errorReturnPage}?uaepass_error=${encodeURIComponent(frontendError)}`,
      { uaepass_error: frontendError }
    );
  }
  if (!code || !state) {
    return finish(verifiedState, `${FRONTEND_URL}/register?uaepass_error=missing_params`, { uaepass_error: 'missing_params' });
  }

  let statePayload;
  let frontendUrl = FRONTEND_URL;
  try {
    statePayload = jwt.verify(state, process.env.JWT_SECRET);
    if (statePayload.frontendUrl) frontendUrl = safeWebOrigin(statePayload.frontendUrl, FRONTEND_URL);
  } catch {
    // Unverifiable state: never trust its app_redirect — web only.
    return finish(null, `${FRONTEND_URL}/register?uaepass_error=invalid_state`, { uaepass_error: 'invalid_state' });
  }

  const isLinkAction = statePayload.action === 'link';

  try {
    // Exchange authorization code for access token
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    console.log('[UAE Pass] token exchange request:', JSON.stringify({
      url: `${BASE_URL}/token`,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_length: code?.length,
    }));
    const tokenExchangeStart = Date.now();
    // Old x-www-form-urlencoded version (kept for quick revert if multipart doesn't work):
    // const tokenRes = await fetch(`${BASE_URL}/token`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/x-www-form-urlencoded',
    //     Authorization: `Basic ${credentials}`,
    //   },
    //   body: new URLSearchParams({
    //     grant_type: 'authorization_code',
    //     code,
    //     redirect_uri: REDIRECT_URI,
    //   }).toString(),
    // });
    const tokenForm = new FormData();
    tokenForm.append('grant_type', 'authorization_code');
    tokenForm.append('code', code);
    tokenForm.append('redirect_uri', REDIRECT_URI);
    const tokenReq = new Request(`${BASE_URL}/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
      },
      body: tokenForm,
    });
    console.log('[UAE Pass] token exchange Content-Type header:', tokenReq.headers.get('content-type'));
    const tokenRes = await fetch(tokenReq);
    console.log('[UAE Pass] token exchange response:', JSON.stringify({
      status: tokenRes.status,
      statusText: tokenRes.statusText,
      ok: tokenRes.ok,
      elapsed_ms: Date.now() - tokenExchangeStart,
      headers: Object.fromEntries(tokenRes.headers.entries()),
    }));

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('[UAE Pass] token exchange failed — status:', tokenRes.status, '| body:', err);
      return finish(
        statePayload,
        isLinkAction ? `${frontendUrl}/settings?uaepass=error` : `${frontendUrl}/register?uaepass_error=token_failed`,
        isLinkAction ? { uaepass: 'error' } : { uaepass_error: 'token_failed' }
      );
    }

    const { access_token } = await tokenRes.json();

    // Fetch user profile
    const infoRes = await fetch(`${BASE_URL}/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!infoRes.ok) {
      return finish(
        statePayload,
        isLinkAction ? `${frontendUrl}/settings?uaepass=error` : `${frontendUrl}/register?uaepass_error=userinfo_failed`,
        isLinkAction ? { uaepass: 'error' } : { uaepass_error: 'userinfo_failed' }
      );
    }

    const info = await infoRes.json();
    console.log('[UAE Pass] userinfo:', JSON.stringify(info, null, 2));

    const userType   = info.userType || '';
    if (userType === 'SOP1') {
      return finish(statePayload, `${errorOrigin}/${errorReturnPage}?uaepass_error=unverified_user`, { uaepass_error: 'unverified_user' });
    }

    const sub        = info.sub;
    const uuid       = info.uuid || null;
    const name       = info.fullnameEN || `${info.firstnameEN || ''} ${info.lastnameEN || ''}`.trim() || '';
    const email      = info.email      || null;
    const phone      = info.mobile     || null;
    const emiratesId = info.idn || info.nationalId || info.national_id || null;
    const nationality= info.nationalityEN || null;
    const title      = info.titleEN    || null;

    // ── MANUAL LINK FLOW (scenarios 1.1.2, 1.1.3, 1.2.2, 1.2.3) ─────────────
    if (isLinkAction) {
      const targetUser = await User.findById(statePayload.userId);
      if (!targetUser) return finish(statePayload, `${frontendUrl}/settings?uaepass=error`, { uaepass: 'error' });

      // Conflict: this UAE Pass sub already linked to a different account
      const conflict = await User.findOne({ uaepassSub: sub });
      if (conflict && conflict._id.toString() !== targetUser._id.toString()) {
        return finish(statePayload, `${frontendUrl}/settings?uaepass=conflict`, { uaepass: 'conflict' });
      }

      const updates = { uaepassSub: sub, uaepassUuid: uuid };
      if (name        && name !== targetUser.name)                    updates.name         = name;
      if (phone       && phone !== targetUser.phone)                  updates.phone        = phone;
      if (emiratesId  && emiratesId !== targetUser.emiratesId)        updates.emiratesId   = emiratesId;
      if (nationality && nationality !== targetUser.nationality)      updates.nationality  = nationality;
      if (title       && title !== targetUser.uaepassTitle)           updates.uaepassTitle = title;
      await User.findByIdAndUpdate(targetUser._id, { $set: updates });
      return finish(statePayload, `${frontendUrl}/settings?uaepass=linked`, { uaepass: 'linked' });
    }

    // ── LOGIN FLOW (scenarios 1.1.1, 1.2.1, 1.3.1) ───────────────────────────
    // Auto-link priority: uaepassSub → email → emiratesId (scenarios 1.1.1, 1.1.3)
    let agent = await User.findOne({ uaepassSub: sub });
    if (!agent && email)      agent = await User.findOne({ email: email.toLowerCase() });
    if (!agent && emiratesId) agent = await User.findOne({ emiratesId });

    if (agent) {
      // Deactivated / not-yet-approved accounts must not get in via UAE Pass either.
      if (!agent.isActive) {
        const code = inactiveMessage(agent) === DEACTIVATED_MESSAGE ? 'account_deactivated' : 'account_not_active';
        return finish(statePayload, `${errorOrigin}/${errorReturnPage}?uaepass_error=${code}`, { uaepass_error: code });
      }
      const updates = {};
      if (!agent.uaepassSub)                                          updates.uaepassSub   = sub;
      if (uuid        && uuid !== agent.uaepassUuid)                  updates.uaepassUuid  = uuid;
      if (name        && name !== agent.name)                         updates.name         = name;
      if (phone       && phone !== agent.phone)                       updates.phone        = phone;
      if (emiratesId  && emiratesId !== agent.emiratesId)             updates.emiratesId   = emiratesId;
      if (nationality && nationality !== agent.nationality)           updates.nationality  = nationality;
      if (title       && title !== agent.uaepassTitle)                updates.uaepassTitle = title;
      if (Object.keys(updates).length) await User.findByIdAndUpdate(agent._id, { $set: updates });
      const token = signAuthToken(agent);
      return await finishWithExchange(statePayload, { token }, `${frontendUrl}/auth/uaepass/callback?token=${token}`);
    }

    // New user — no email from UAE Pass → prefill register form
    if (!email) {
      const prefill = jwt.sign(
        { name, phone, emiratesId, nationality, sub, _uaepass: true },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );
      return await finishWithExchange(statePayload, { prefill }, `${frontendUrl}/register?uaepass_prefill=${prefill}`);
    }

    // Create new agent directly (scenarios 1.2.1, 1.3.1)
    let refCode;
    while (true) {
      refCode = generateReferralCode();
      if (!(await User.findOne({ referralCode: refCode }))) break;
    }

    agent = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      role: 'agent',
      referralCode: refCode,
      isActive: true,
      uaepassSub: sub,
      ...(uuid         ? { uaepassUuid: uuid } : {}),
      ...(emiratesId   ? { emiratesId }        : {}),
      ...(nationality  ? { nationality }        : {}),
      ...(title        ? { uaepassTitle: title } : {}),
    });

    const token = signAuthToken(agent);
    return await finishWithExchange(statePayload, { token }, `${frontendUrl}/auth/uaepass/callback?token=${token}`);
  } catch (err) {
    console.error('[UAE Pass callback]', err.message);
    return finish(
      statePayload,
      isLinkAction ? `${frontendUrl}/settings?uaepass=error` : `${frontendUrl}/register?uaepass_error=server_error`,
      isLinkAction ? { uaepass: 'error' } : { uaepass_error: 'server_error' }
    );
  }
};
