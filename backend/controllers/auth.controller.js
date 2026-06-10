const crypto = require('crypto');
const User = require('../models/User');
const { signAuthToken, generateReferralCode } = require('../utils/token');
const { sendPasswordResetEmail } = require('../utils/email');

/**
 * Public-safe user shape returned to clients.
 * @typedef {{
 *   id: string, name: string, email: string, phone: string,
 *   role: 'admin'|'agency'|'agent',
 *   referralCode?: string
 * }} SafeUser
 */
const sanitize = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  referralCode: user.referralCode,
  employeeType: user.employeeType,
});

const sanitizeFull = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  referralCode: user.referralCode,
  leadCount: user.leadCount,
  isActive: user.isActive,
  createdAt: user.createdAt,
  agency: user.agency,
  referredBy: user.referredBy,
  bankDetails: user.bankDetails,
  emiratesId: user.emiratesId,
});

const safeUser = async (id) =>
  User.findById(id).select('-password -inviteToken -inviteTokenExpires');

/**
 * POST /api/auth/register-agent  (public)
 */
exports.registerAgent = async (req, res) => {
  try {
    const { name, email, password, phone, referralCode, emiratesId, uaepassSub } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    let referredBy;
    if (referralCode) {
      const refUser = await User.findOne({ referralCode: referralCode.toUpperCase(), role: 'agent' });
      if (!refUser) return res.status(400).json({ message: 'Invalid referral code' });
      referredBy = refUser._id;
    }

    let code;
    while (true) {
      code = generateReferralCode();
      const collision = await User.findOne({ referralCode: code });
      if (!collision) break;
    }

    const agent = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone,
      role: 'agent',
      referralCode: code,
      referredBy,
      isActive: true,
      ...(emiratesId   ? { emiratesId }   : {}),
      ...(uaepassSub   ? { uaepassSub }   : {}),
    });

    const token = signAuthToken(agent);
    res.status(201).json({ token, user: sanitize(agent) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/auth/register-agency  (public — self-registration, requires admin approval)
 */
exports.registerAgency = async (req, res) => {
  try {
    const { name, companyName, tradeLicense, email, phone, password, emiratesId, city } = req.body;
    if (!companyName || !email || !password) {
      return res.status(400).json({ message: 'Company name, email, and password are required' });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    await User.create({
      name: name || companyName,
      companyName,
      tradeLicense,
      email: email.toLowerCase(),
      password,
      phone,
      emiratesId,
      location: city,
      role: 'agency',
      isActive: false,
      registrationStatus: 'pending',
    });

    res.status(201).json({ message: 'Registration submitted. Awaiting admin approval.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/auth/login  (public — all roles)
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.password) return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.isActive) {
      if (user.registrationStatus === 'pending') return res.status(403).json({ message: 'Account pending admin approval.' });
      if (user.registrationStatus === 'rejected') return res.status(403).json({ message: 'Account registration was rejected. Contact support.' });
      return res.status(403).json({ message: 'Account not activated. Check your invite email.' });
    }

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signAuthToken(user);
    const full = await safeUser(user._id);
    res.json({ token, user: sanitize(full) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/auth/invite/:token  (public)
 */
exports.verifyInvite = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({
      inviteToken: token,
      inviteTokenExpires: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ message: 'Invalid or expired invite' });
    res.json({ email: user.email, role: user.role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/auth/set-password  (public — completes invitation)
 */
exports.setPassword = async (req, res) => {
  try {
    const { token, password, name, phone } = req.body;
    if (!token || !password) return res.status(400).json({ message: 'Token and password are required' });

    const user = await User.findOne({
      inviteToken: token,
      inviteTokenExpires: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ message: 'Invalid or expired invite' });

    user.password = password;
    if (name) user.name = name;
    if (phone) user.phone = phone;
    user.isActive = true;
    user.inviteToken = undefined;
    user.inviteTokenExpires = undefined;
    await user.save();

    const authToken = signAuthToken(user);
    const full = await safeUser(user._id);
    res.json({ token: authToken, user: sanitize(full) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/auth/me  (any authenticated user)
 */
exports.me = async (req, res) => {
  try {
    const full = await safeUser(req.user._id);
    res.json({ user: sanitize(full) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/auth/profile  (any authenticated user) — full profile with populated refs
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -inviteToken -inviteTokenExpires')
      .populate('agency', 'name email phone')
      .populate('referredBy', 'name email referralCode');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: sanitizeFull(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/auth/profile  (any authenticated user) — update name, phone, password
 */
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, emiratesId, currentPassword, newPassword, bankDetails } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name !== undefined && name.trim()) user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (emiratesId !== undefined) user.emiratesId = emiratesId.trim() || null;

    if (bankDetails && typeof bankDetails === 'object' && user.role === 'agent') {
      const bd = bankDetails;
      if (!user.bankDetails) user.bankDetails = {};
      if (bd.accountHolderName !== undefined) user.bankDetails.accountHolderName = bd.accountHolderName;
      if (bd.bankName !== undefined) user.bankDetails.bankName = bd.bankName;
      if (bd.accountNumber !== undefined) user.bankDetails.accountNumber = bd.accountNumber;
      if (bd.iban !== undefined) user.bankDetails.iban = bd.iban;
      if (bd.swiftCode !== undefined) user.bankDetails.swiftCode = bd.swiftCode;
    }

    if (newPassword) {
      if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 characters' });
      user.password = newPassword;
    }

    await user.save();
    const updated = await User.findById(user._id)
      .select('-password -inviteToken -inviteTokenExpires')
      .populate('agency', 'name email phone')
      .populate('referredBy', 'name email referralCode');
    res.json({ user: sanitizeFull(updated) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/auth/forgot-password  (public)
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    // Always respond success to prevent email enumeration
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    await sendPasswordResetEmail({ to: user.email, resetUrl, name: user.name });

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/auth/reset-password  (public)
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ message: 'Token and password are required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ message: 'Reset link is invalid or has expired' });

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
