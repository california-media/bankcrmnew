const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const signAuthToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const generateInviteToken = () => crypto.randomBytes(32).toString('hex');

const generateReferralCode = () =>
  crypto.randomBytes(4).toString('hex').toUpperCase();

module.exports = { signAuthToken, generateInviteToken, generateReferralCode };
