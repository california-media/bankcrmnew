const User = require('../models/User');
const { generateInviteToken } = require('../utils/token');
const { sendInviteEmail } = require('../utils/email');

// POST /agencies (admin) — create agency invite
exports.create = async (req, res) => {
  try {
    const { name, email, banks } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    if (!Array.isArray(banks) || banks.length === 0) {
      return res.status(400).json({ message: 'Select at least one bank' });
    }

    const lower = email.toLowerCase();
    const exists = await User.findOne({ email: lower });
    if (exists) return res.status(409).json({ message: 'A user with this email already exists' });

    const inviteToken = generateInviteToken();
    const inviteTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const agency = await User.create({
      name,
      email: lower,
      role: 'agency',
      banks,
      inviteToken,
      inviteTokenExpires,
      isActive: false,
    });

    const inviteUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/set-password?token=${inviteToken}`;
    const result = await sendInviteEmail({ to: lower, inviteUrl });

    res.status(201).json({
      agency: { id: agency._id, name: agency.name, email: agency.email, banks: agency.banks },
      inviteUrl: result.dev ? inviteUrl : undefined,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /agencies (admin) — list agencies
exports.list = async (req, res) => {
  const agencies = await User.find({ role: 'agency' })
    .populate('banks', 'name code')
    .select('-password -inviteToken -inviteTokenExpires')
    .sort({ createdAt: -1 });
  res.json(agencies);
};

// POST /agencies/:id/resend-invite (admin)
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
