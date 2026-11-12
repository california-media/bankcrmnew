const { normalizeCode } = require('./inviteMatch');

// Invite links + UAE PASS (mobile app spec 2026-11-12): a new partner who signs up with UAE PASS after tapping an
// agent's invite link keeps the invite. The app (or website) sends the code as ?ref= to /auth/uaepass/init; it
// travels inside the signed state, so it can't be changed on the way back.

/** The invite part of the UAE PASS state: { ref } for a valid code, else nothing. */
function inviteStateOf(query) {
  const ref = normalizeCode(query && query.ref);
  return ref ? { ref } : {};
}

/** The inviting agent's id from a verified state payload (an active agent with that code), or null. */
async function inviterFor(payload, User) {
  const ref = normalizeCode(payload && payload.ref);
  if (!ref) return null;
  const inviter = await User.findOne({ referralCode: ref, role: 'agent', isActive: true }).select('_id').lean();
  return inviter ? inviter._id : null;
}

module.exports = { inviteStateOf, inviterFor };
