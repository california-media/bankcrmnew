const User = require('../models/User');
const { signAuthToken, generateReferralCode } = require('../utils/token');

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
});

const safeUser = async (id) =>
  User.findById(id).select('-password -inviteToken -inviteTokenExpires');

/**
 * POST /api/auth/register-agent  (public)
 */
exports.registerAgent = async (req, res) => {
  try {
    const { name, email, password, phone, referralCode } = req.body;
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
    });

    const token = signAuthToken(agent);
    res.status(201).json({ token, user: sanitize(agent) });
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
    if (!user.isActive) return res.status(403).json({ message: 'Account not activated. Check your invite email.' });

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
