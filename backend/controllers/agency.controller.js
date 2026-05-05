const User = require('../models/User');
const { generateInviteToken } = require('../utils/token');
const { sendInviteEmail } = require('../utils/email');

const sanitizeAgency = (a) => ({
  _id: a._id,
  id: a._id,
  name: a.name,
  email: a.email,
  isActive: a.isActive,
  createdAt: a.createdAt,
});

/**
 * POST /api/agencies  (admin)
 * Body: { name?: string, email: string }
 * Creates an inactive agency user with an invite token. The agency adds their
 * own banks and commission rules after activating.
 */
exports.create = async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const lower = email.toLowerCase();
    const exists = await User.findOne({ email: lower });
    if (exists) return res.status(409).json({ message: 'A user with this email already exists' });

    const inviteToken = generateInviteToken();
    const inviteTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const agency = await User.create({
      name,
      email: lower,
      role: 'agency',
      inviteToken,
      inviteTokenExpires,
      isActive: false,
    });

    const inviteUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/set-password?token=${inviteToken}`;
    const result = await sendInviteEmail({ to: lower, inviteUrl });

    res.status(201).json({
      agency: sanitizeAgency(agency),
      inviteUrl: result.dev ? inviteUrl : undefined,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/agencies  (admin)
 */
exports.list = async (req, res) => {
  try {
    const agencies = await User.find({ role: 'agency' })
      .select('-password -inviteToken -inviteTokenExpires')
      .sort({ createdAt: -1 });
    res.json(agencies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/agencies/:id/resend-invite  (admin)
 */
exports.resendInvite = async (req, res) => {
  try {
    const agency = await User.findOne({ _id: req.params.id, role: 'agency' });
    if (!agency) return res.status(404).json({ message: 'Agency not found' });
    if (agency.isActive) return res.status(400).json({ message: 'Agency already activated' });

    agency.inviteToken = generateInviteToken();
    agency.inviteTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await agency.save();

    const inviteUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/set-password?token=${agency.inviteToken}`;
    const result = await sendInviteEmail({ to: agency.email, inviteUrl });
    res.json({ ok: true, inviteUrl: result.dev ? inviteUrl : undefined });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
