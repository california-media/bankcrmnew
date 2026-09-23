const User = require('../models/User');
const { resolveAgencyId } = require('../middleware/auth.middleware');
const { generateReferralCode } = require('../utils/token');

/**
 * POST /api/agents  (agency)
 * Agency creates an Agent account tagged to itself — that agent's disbursed
 * leads earn this agency the per-product agencyOverride amount.
 * Body: { name, email, password, phone? }
 */
exports.create = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ message: 'Email already in use' });

    let referralCode;
    while (true) {
      referralCode = generateReferralCode();
      const collision = await User.findOne({ referralCode });
      if (!collision) break;
    }

    const agent = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password,
      phone,
      role: 'agent',
      agency: resolveAgencyId(req.user),
      referralCode,
      isActive: true,
    });

    const sanitized = agent.toObject();
    delete sanitized.password;
    res.status(201).json(sanitized);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/agents  (agency)
 * Returns all agents this agency has created.
 */
exports.list = async (req, res) => {
  try {
    const agents = await User.find({ agency: resolveAgencyId(req.user), role: 'agent' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(agents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/agents/:id  (agency)
 */
exports.update = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const agent = await User.findOne({ _id: req.params.id, role: 'agent', agency: resolveAgencyId(req.user) });
    if (!agent) return res.status(404).json({ message: 'Agent not found' });

    if (name) agent.name = name.trim();
    if (email) {
      const existing = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: agent._id } });
      if (existing) return res.status(409).json({ message: 'Email already in use' });
      agent.email = email.toLowerCase().trim();
    }
    if (phone !== undefined) agent.phone = phone;
    await agent.save();

    const sanitized = agent.toObject();
    delete sanitized.password;
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/agents/:id/toggle  (agency) — activate/deactivate.
 */
exports.toggleActive = async (req, res) => {
  try {
    const agent = await User.findOne({ _id: req.params.id, role: 'agent', agency: resolveAgencyId(req.user) });
    if (!agent) return res.status(404).json({ message: 'Agent not found' });
    agent.isActive = !agent.isActive;
    await agent.save();
    res.json({ isActive: agent.isActive });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
