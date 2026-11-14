// Sign-up with UAE PASS from the mobile app's Register Super Referral Partner page (mobile app spec 2026-11-13).
// The app sends ?account=super_agent to /auth/uaepass/init; it travels inside the signed state. A new person on
// that path is never created straight away (a super agent needs a verified phone, a password, a city and admin
// approval): they always get the prefill, which the app sends back to POST /auth/register-agency.

/** The account part of the UAE PASS state: { account: 'super_agent' } or nothing. */
function accountStateOf(query) {
  return query && query.account === 'super_agent' ? { account: 'super_agent' } : {};
}

/**
 * The prefill claims for a new UAE PASS user, or null when the agent account is created straight away
 * (an agent sign-up where UAE PASS returned an email).
 */
function signupPrefill(payload, { name, phone, emiratesId, nationality, sub, email }) {
  const superAgent = !!payload && payload.account === 'super_agent';
  if (email && !superAgent) return null;
  return {
    name, phone, emiratesId, nationality, sub,
    ...(superAgent ? { ...(email ? { email } : {}), account: 'super_agent' } : {}),
    _uaepass: true,
  };
}

module.exports = { accountStateOf, signupPrefill };
