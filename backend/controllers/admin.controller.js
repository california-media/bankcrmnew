const User = require('../models/User');
const Lead = require('../models/Lead');
const { generateReferralCode } = require('../utils/token');

const sanitizeAgent = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  referralCode: user.referralCode,
  isActive: user.isActive,
  createdAt: user.createdAt,
});

/**
 * GET /api/admin/agents  (admin)
 * Response: agents with summary counts (total leads, approved leads, paid commission).
 */
exports.listAgents = async (req, res) => {
  try {
    const agents = await User.find({ role: 'agent' })
      .select('-password -inviteToken -inviteTokenExpires')
      .populate('referredBy', 'name email referralCode')
      .sort({ createdAt: -1 });

    const ids = agents.map((a) => a._id);
    const stats = await Lead.aggregate([
      { $match: { agent: { $in: ids } } },
      {
        $group: {
          _id: '$agent',
          total: { $sum: 1 },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          paidCommission: {
            $sum: { $cond: [{ $eq: ['$commissionStatus', 'paid'] }, '$commission', 0] },
          },
        },
      },
    ]);
    const byAgent = Object.fromEntries(stats.map((s) => [String(s._id), s]));

    const enriched = agents.map((a) => ({
      ...a.toObject(),
      stats: byAgent[String(a._id)] || { total: 0, approved: 0, paidCommission: 0 },
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/admin/overview  (admin)
 * Top-level counts for the admin landing page.
 */
exports.overview = async (req, res) => {
  try {
    const [agents, agencies, banks, totalLeads, approvedLeads, pendingLeads, paidAgg, payableAgg] = await Promise.all([
      User.countDocuments({ role: 'agent' }),
      User.countDocuments({ role: 'agency' }),
      require('../models/Bank').countDocuments(),
      Lead.countDocuments(),
      Lead.countDocuments({ status: 'approved' }),
      Lead.countDocuments({ status: { $in: ['submitted', 'under_review'] } }),
      Lead.aggregate([{ $match: { commissionStatus: 'paid' } }, { $group: { _id: null, sum: { $sum: '$commission' } } }]),
      Lead.aggregate([{ $match: { commissionStatus: 'payable' } }, { $group: { _id: null, sum: { $sum: '$commission' } } }]),
    ]);
    res.json({
      agents,
      agencies,
      banks,
      totalLeads,
      approvedLeads,
      pendingLeads,
      paidCommission: paidAgg[0]?.sum || 0,
      payableCommission: payableAgg[0]?.sum || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/admin/agents  (admin)
 * Body: { name, email, password, phone? }
 * Response 201: { user }
 */
exports.createAgent = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'name, email, and password are required' });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    const agent = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone: phone || undefined,
      role: 'agent',
      isActive: true,
      referralCode: generateReferralCode(),
    });

    res.status(201).json({ user: sanitizeAgent(agent) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/admin/agents/:id  (admin)
 * Body: { name?, email?, phone? }
 */
exports.updateAgent = async (req, res) => {
  try {
    const agent = await User.findOne({ _id: req.params.id, role: 'agent' });
    if (!agent) return res.status(404).json({ message: 'Agent not found' });

    const { name, email, phone } = req.body;
    if (name !== undefined) agent.name = name;
    if (phone !== undefined) agent.phone = phone;
    if (email) {
      const lower = email.toLowerCase();
      const conflict = await User.findOne({ email: lower, _id: { $ne: agent._id } });
      if (conflict) return res.status(409).json({ message: 'Email already in use' });
      agent.email = lower;
    }
    await agent.save();
    res.json({ user: sanitizeAgent(agent) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/admin/agents/:id/toggle-active  (admin)
 */
exports.toggleAgentActive = async (req, res) => {
  try {
    const agent = await User.findOne({ _id: req.params.id, role: 'agent' });
    if (!agent) return res.status(404).json({ message: 'Agent not found' });
    agent.isActive = !agent.isActive;
    await agent.save();
    res.json({ user: sanitizeAgent(agent) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /api/admin/agents/:id  (admin)
 */
exports.deleteAgent = async (req, res) => {
  try {
    const agent = await User.findOneAndDelete({ _id: req.params.id, role: 'agent' });
    if (!agent) return res.status(404).json({ message: 'Agent not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
