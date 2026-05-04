const User = require('../models/User');
const { generateInviteToken } = require('../utils/token');
const { sendInviteEmail } = require('../utils/email');

/**
 * POST /api/agencies  (admin)
 * Body: { name?: string, email: string (required), banks: ObjectId[] (>=1) }
 * Response 201: { agency: { id, name, email, banks: ObjectId[] }, inviteUrl?: string }
 *   inviteUrl is only returned when SMTP is unconfigured (dev mode).
 * Errors: 400 missing fields, 409 email taken
 */
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

/**
 * GET /api/agencies  (admin)
 * Response: Array<Agency User> with banks populated ({ name, code }), newest first.
 */
exports.list = async (req, res) => {
  try {
    const agencies = await User.find({ role: 'agency' })
      .populate('banks', 'name code')
      .select('-password -inviteToken -inviteTokenExpires')
      .sort({ createdAt: -1 });
    res.json(agencies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/agencies/for-bank/:bankId  (agent, admin)
 * Active agencies whose `banks` includes the given bankId.
 * Used by the agent's Submit Lead form to populate the agency dropdown.
 * Response: Array<{ _id, name, email }>
 */
exports.listForBank = async (req, res) => {
  try {
    const agencies = await User.find({
      role: 'agency',
      isActive: true,
      banks: req.params.bankId,
    })
      .select('_id name email')
      .sort({ name: 1, email: 1 });
    res.json(agencies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/agencies/:id/resend-invite  (admin)
 * Response: { ok: true, inviteUrl?: string }
 *   inviteUrl is only returned when SMTP is unconfigured (dev mode).
 * Errors: 404 not found, 400 already activated
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
