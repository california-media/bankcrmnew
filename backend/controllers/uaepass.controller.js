const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { signAuthToken, generateReferralCode } = require('../utils/token');

const IS_STAGING   = process.env.UAEPASS_ENV !== 'production';
const BASE_URL     = IS_STAGING ? 'https://stg-id.uaepass.ae/idshub' : 'https://id.uaepass.ae/idshub';
const CLIENT_ID    = process.env.UAEPASS_CLIENT_ID     || 'sandbox_stage';
const CLIENT_SECRET= process.env.UAEPASS_CLIENT_SECRET || 'sandbox_stage';
const REDIRECT_URI = process.env.UAEPASS_REDIRECT_URI  || 'http://localhost:8000/api/auth/uaepass/callback';
const FRONTEND_URL = process.env.CLIENT_URL             || 'http://localhost:5173';

const sanitize = (user) => ({
  id: user._id, name: user.name, email: user.email,
  phone: user.phone, role: user.role, referralCode: user.referralCode,
});

/**
 * GET /api/auth/uaepass/init
 * Redirects agent to UAE Pass authorization page.
 */
exports.init = (req, res) => {
  const state = jwt.sign({ ctx: 'uaepass' }, process.env.JWT_SECRET, { expiresIn: '10m' });
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: 'urn:uae:digitalid:profile:general',
    redirect_uri: REDIRECT_URI,
    state,
    acr_values: 'urn:safelayer:tws:policies:authentication:level:low',
  });
  res.redirect(`${BASE_URL}/authorize?${params.toString()}`);
};

/**
 * GET /api/auth/uaepass/callback
 * Handles redirect from UAE Pass, creates/links agent, issues JWT.
 */
exports.callback = async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${FRONTEND_URL}/register?uaepass_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}/register?uaepass_error=missing_params`);
  }

  // Validate CSRF state
  try {
    jwt.verify(state, process.env.JWT_SECRET);
  } catch {
    return res.redirect(`${FRONTEND_URL}/register?uaepass_error=invalid_state`);
  }

  try {
    // Exchange code for access token
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
      return res.redirect(`${FRONTEND_URL}/register?uaepass_error=token_failed`);
    }

    const { access_token } = await tokenRes.json();

    // Fetch user profile from UAE Pass
    const infoRes = await fetch(`${BASE_URL}/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!infoRes.ok) {
      return res.redirect(`${FRONTEND_URL}/register?uaepass_error=userinfo_failed`);
    }

    const info = await infoRes.json();
    const sub        = info.sub;
    const name       = info.fullnameEN || `${info.firstnameEN || ''} ${info.lastnameEN || ''}`.trim() || '';
    const email      = info.email      || null;
    const phone      = info.mobile     || null;
    const emiratesId = info.idn        || null;
    const nationality= info.nationalityEN || null;

    // Returning user — find by uaepassSub or email
    let agent = await User.findOne({ uaepassSub: sub });
    if (!agent && email) agent = await User.findOne({ email: email.toLowerCase() });

    if (agent) {
      if (!agent.uaepassSub) { agent.uaepassSub = sub; await agent.save(); }
      const token = signAuthToken(agent);
      return res.redirect(`${FRONTEND_URL}/auth/uaepass/callback?token=${token}`);
    }

    // New agent — if no email from UAE Pass, redirect to register with prefill
    if (!email) {
      const prefill = jwt.sign(
        { name, phone, emiratesId, nationality, sub, _uaepass: true },
        process.env.JWT_SECRET,
        { expiresIn: '30m' }
      );
      return res.redirect(`${FRONTEND_URL}/register?uaepass_prefill=${prefill}`);
    }

    // Create new agent directly
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
      ...(emiratesId   ? { emiratesId }   : {}),
    });

    const token = signAuthToken(agent);
    res.redirect(`${FRONTEND_URL}/auth/uaepass/callback?token=${token}`);
  } catch (err) {
    console.error('[UAE Pass callback]', err.message);
    res.redirect(`${FRONTEND_URL}/register?uaepass_error=server_error`);
  }
};
