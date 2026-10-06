const User = require('../models/User');
const { generateReferralCode } = require('./token');

const DEACTIVATED_MESSAGE =
  'Your account has been deactivated. Kindly contact support for activation on support@mysilah.ae';

const generateSuperAgentCode = async () => {
  while (true) {
    const code = `SA${generateReferralCode().slice(0, 6)}`;
    if (!(await User.findOne({ superAgentCode: code }))) return code;
  }
};

const generateUniqueReferralCode = async () => {
  while (true) {
    const code = generateReferralCode();
    if (!(await User.findOne({ referralCode: code }))) return code;
  }
};

// Why an inactive account can't log in, as a user-facing message.
// Distinguishes "never activated yet" from "was active, now deactivated".
const inactiveMessage = (user) => {
  if (user.registrationStatus === 'pending') return 'Account pending admin approval.';
  if (user.registrationStatus === 'rejected') return 'Account registration was rejected. Contact support.';
  if (user.emailVerifyToken) return 'Please verify your email address using the link we sent you before logging in.';
  if (user.inviteToken) return 'Account not activated. Check your invite email.';
  return DEACTIVATED_MESSAGE;
};

// Called whenever a super agent goes inactive. Leads already submitted keep
// the super agent (locked on the lead); from now on their sub-agents belong to
// MySilah directly, so new leads earn the super agent nothing.
const releaseSubAgents = async (superAgentId) =>
  User.updateMany({ superAgent: superAgentId }, { $set: { superAgent: null } });

// The super agent a newly submitted lead should be attached to: only if the
// submitting agent still has one AND that super agent is currently active.
const resolveActiveSuperAgentId = async (agentUser) => {
  if (!agentUser?.superAgent) return null;
  const sa = await User.findOne({ _id: agentUser.superAgent, isSuperAgent: true, isActive: true }).select('_id').lean();
  return sa ? sa._id : null;
};

module.exports = {
  DEACTIVATED_MESSAGE,
  generateSuperAgentCode,
  generateUniqueReferralCode,
  inactiveMessage,
  releaseSubAgents,
  resolveActiveSuperAgentId,
};
