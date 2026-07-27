const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { signAuthToken, generateReferralCode } = require('../utils/token');

const IS_STAGING   = process.env.UAEPASS_ENV !== 'production';
const BASE_URL     = IS_STAGING ? 'https://stg-id.uaepass.ae/idshub' : 'https://id.uaepass.ae/idshub';
const CLIENT_ID    = process.env.UAEPASS_CLIENT_ID     || 'sandbox_stage';
const CLIENT_SECRET= process.env.UAEPASS_CLIENT_SECRET || 'sandbox_stage';
const REDIRECT_URI = process.env.UAEPASS_REDIRECT_URI  || 'http://localhost:8000/api/auth/uaepass/callback';
const FRONTEND_URL = process.env.CLIENT_URL             || 'http://localhost:5173';

const buildAuthUrl = (state) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: 'urn:uae:digitalid:profile:general urn:uae:digitalid:profile',
    redirect_uri: REDIRECT_URI,
    state,
    acr_values: IS_STAGING
      ? 'urn:safelayer:tws:policies:authentication:level:low'
      : 'urn:safelayer:tws:policies:authentication:level:2',
  });
  return `${BASE_URL}/authorize?${params.toString()}`;
};

const getFrontendUrl = (req) => {
  try {
    const referer = req.headers.referer || req.headers.referrer || req.headers.origin;
    if (referer) return new URL(referer).origin;
  } catch {}
  return FRONTEND_URL;
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
  const state = jwt.sign({ ctx: 'uaepass', frontendUrl, returnPage }, process.env.JWT_SECRET, { expiresIn: '10m' });
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

  // Resolve origin + returnPage from state even on error
  const resolveState = (s) => {
    try {
      const payload = jwt.verify(s, process.env.JWT_SECRET);
      return { origin: payload.frontendUrl || FRONTEND_URL, returnPage: payload.returnPage || 'register' };
    } catch { return { origin: FRONTEND_URL, returnPage: 'register' }; }
  };
  const { origin: errorOrigin, returnPage: errorReturnPage } = state ? resolveState(state) : { origin: FRONTEND_URL, returnPage: 'register' };

  if (error) {
    console.log('[UAE Pass callback] error:', error, '| error_description:', error_description, '| all params:', JSON.stringify(req.query));
    let frontendError = error;
    if (error === 'cancelledOnApp') {
      const desc = (error_description || '').toLowerCase();
      if (desc.includes('web') || (desc.includes('cancel') && desc.includes('web'))) {
        frontendError = 'cancelledOnWeb';
      }
    }
    return res.redirect(`${errorOrigin}/${errorReturnPage}?uaepass_error=${encodeURIComponent(frontendError)}`);
  }
  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}/register?uaepass_error=missing_params`);
  }

  let statePayload;
  let frontendUrl = FRONTEND_URL;
  try {
    statePayload = jwt.verify(state, process.env.JWT_SECRET);
    if (statePayload.frontendUrl) frontendUrl = statePayload.frontendUrl;
  } catch {
    return res.redirect(`${FRONTEND_URL}/register?uaepass_error=invalid_state`);
  }

  const isLinkAction = statePayload.action === 'link';

  try {
    // Exchange authorization code for access token
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const tokenRes = await fetch(`${BASE_URL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('[UAE Pass] token exchange failed:', err);
      return res.redirect(isLinkAction
        ? `${frontendUrl}/settings?uaepass=error`
        : `${frontendUrl}/register?uaepass_error=token_failed`);
    }

    const { access_token } = await tokenRes.json();

    // Fetch user profile
    const infoRes = await fetch(`${BASE_URL}/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!infoRes.ok) {
      return res.redirect(isLinkAction
        ? `${frontendUrl}/settings?uaepass=error`
        : `${frontendUrl}/register?uaepass_error=userinfo_failed`);
    }

    const info = await infoRes.json();
    console.log('[UAE Pass] userinfo:', JSON.stringify(info, null, 2));

    const sub        = info.sub;
    const name       = info.fullnameEN || `${info.firstnameEN || ''} ${info.lastnameEN || ''}`.trim() || '';
    const email      = info.email      || null;
    const phone      = info.mobile     || null;
    const emiratesId = info.idn || info.nationalId || info.national_id || null;
    const nationality= info.nationalityEN || null;

    // ── MANUAL LINK FLOW (scenarios 1.1.2, 1.1.3, 1.2.2, 1.2.3) ─────────────
    if (isLinkAction) {
      const targetUser = await User.findById(statePayload.userId);
      if (!targetUser) return res.redirect(`${frontendUrl}/settings?uaepass=error`);

      // Conflict: this UAE Pass sub already linked to a different account
      const conflict = await User.findOne({ uaepassSub: sub });
      if (conflict && conflict._id.toString() !== targetUser._id.toString()) {
        return res.redirect(`${frontendUrl}/settings?uaepass=conflict`);
      }

      const updates = { uaepassSub: sub };
      if (name        && name !== targetUser.name)              updates.name        = name;
      if (phone       && phone !== targetUser.phone)            updates.phone       = phone;
      if (emiratesId  && emiratesId !== targetUser.emiratesId)  updates.emiratesId  = emiratesId;
      if (nationality && nationality !== targetUser.nationality) updates.nationality = nationality;
      await User.findByIdAndUpdate(targetUser._id, { $set: updates });
      return res.redirect(`${frontendUrl}/settings?uaepass=linked`);
    }

    // ── LOGIN FLOW (scenarios 1.1.1, 1.2.1, 1.3.1) ───────────────────────────
    // Auto-link priority: uaepassSub → email → emiratesId (scenarios 1.1.1, 1.1.3)
    let agent = await User.findOne({ uaepassSub: sub });
    if (!agent && email)      agent = await User.findOne({ email: email.toLowerCase() });
    if (!agent && emiratesId) agent = await User.findOne({ emiratesId });

    if (agent) {
      const updates = {};
      if (!agent.uaepassSub)                                    updates.uaepassSub  = sub;
      if (name        && name !== agent.name)                   updates.name        = name;
      if (phone       && phone !== agent.phone)                 updates.phone       = phone;
      if (emiratesId  && emiratesId !== agent.emiratesId)       updates.emiratesId  = emiratesId;
      if (nationality && nationality !== agent.nationality)     updates.nationality = nationality;
      if (Object.keys(updates).length) await User.findByIdAndUpdate(agent._id, { $set: updates });
      const token = signAuthToken(agent);
      return res.redirect(`${frontendUrl}/auth/uaepass/callback?token=${token}`);
    }

    // New user — no email from UAE Pass → prefill register form
    if (!email) {
      const prefill = jwt.sign(
        { name, phone, emiratesId, nationality, sub, _uaepass: true },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );
      return res.redirect(`${frontendUrl}/register?uaepass_prefill=${prefill}`);
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
      ...(emiratesId  ? { emiratesId }  : {}),
      ...(nationality ? { nationality } : {}),
    });

    const token = signAuthToken(agent);
    res.redirect(`${frontendUrl}/auth/uaepass/callback?token=${token}`);
  } catch (err) {
    console.error('[UAE Pass callback]', err.message);
    res.redirect(isLinkAction
      ? `${frontendUrl}/settings?uaepass=error`
      : `${frontendUrl}/register?uaepass_error=server_error`);
  }
};
