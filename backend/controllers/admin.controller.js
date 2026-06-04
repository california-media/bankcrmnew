const User = require('../models/User');
const Lead = require('../models/Lead');
const { generateReferralCode } = require('../utils/token');

const sanitizeAgent = (user) => ({
  id: user._id,
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  referralCode: user.referralCode,
  isActive: user.isActive,
  createdAt: user.createdAt,
  bankDetails: user.bankDetails,
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
    const [agents, agencies, banks, totalLeads, approvedLeads, pendingLeads, activeLeads, cpvDoneLeads, activateDoneLeads, paidAgg, payableAgg, pipelineAgg, topAgentsAgg, productPayoutsAgg] = await Promise.all([
      User.countDocuments({ role: 'agent' }),
      User.countDocuments({ role: 'agency' }),
      require('../models/Bank').countDocuments(),
      Lead.countDocuments(),
      Lead.countDocuments({ status: 'approved' }),
      Lead.countDocuments({ status: { $in: ['submitted', 'under_review'] } }),
      Lead.countDocuments({ status: { $in: ['submitted', 'under_review', 'assigned', 'approved'] } }),
      Lead.countDocuments({ cpvDone: true }),
      Lead.countDocuments({ activateDone: true }),
      Lead.aggregate([{ $match: { commissionStatus: 'paid' } }, { $group: { _id: null, sum: { $sum: '$commission' } } }]),
      Lead.aggregate([{ $match: { commissionStatus: 'payable' } }, { $group: { _id: null, sum: { $sum: '$commission' } } }]),
      Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Lead.aggregate([
        { $match: { commissionStatus: 'paid' } },
        { $group: { _id: '$agent', paid: { $sum: '$commission' } } },
        { $sort: { paid: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'agentDoc' } },
        { $unwind: '$agentDoc' },
        { $project: { _id: 1, name: '$agentDoc.name', email: '$agentDoc.email', paid: 1 } },
      ]),
      Lead.aggregate([
        { $match: { commissionStatus: 'paid' } },
        { $group: { _id: '$productType', paid: { $sum: '$commission' }, count: { $sum: 1 } } },
      ]),
    ]);

    const pipelineMap = Object.fromEntries(pipelineAgg.map((p) => [p._id, p.count]));
    const pipeline = [
      { status: 'draft', label: 'Draft', count: pipelineMap.draft || 0 },
      { status: 'submitted', label: 'Submitted', count: pipelineMap.submitted || 0 },
      { status: 'under_review', label: 'Under Review', count: pipelineMap.under_review || 0 },
      { status: 'assigned', label: 'Assigned', count: pipelineMap.assigned || 0 },
      { status: 'approved', label: 'Approved', count: pipelineMap.approved || 0 },
      { status: 'disbursed', label: 'Disbursed', count: pipelineMap.disbursed || 0 },
      { status: 'rejected', label: 'Rejected', count: pipelineMap.rejected || 0 },
    ];

    const PRODUCT_LABELS = { credit_card: 'Credit Card', loan: 'Loan' };
    const productPayouts = productPayoutsAgg.map((p) => ({
      type: p._id,
      label: PRODUCT_LABELS[p._id] || p._id,
      paid: p.paid,
      count: p.count,
    }));

    res.json({
      agents,
      agencies,
      banks,
      totalLeads,
      approvedLeads,
      pendingLeads,
      activeLeads,
      cpvDoneLeads,
      activateDoneLeads,
      paidCommission: paidAgg[0]?.sum || 0,
      payableCommission: payableAgg[0]?.sum || 0,
      pipeline,
      topAgents: topAgentsAgg,
      productPayouts,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/admin/agents/:id  (admin)
 */
exports.getAgent = async (req, res) => {
  try {
    const agent = await User.findOne({ _id: req.params.id, role: 'agent' })
      .select('-password -inviteToken -inviteTokenExpires')
      .populate('referredBy', 'name email referralCode');
    if (!agent) return res.status(404).json({ message: 'Agent not found' });

    const leads = await Lead.find({ agent: agent._id })
      .select('status commission commissionStatus createdAt customerName bank productType loanAmount leadNumber')
      .populate('bank', 'name')
      .sort({ createdAt: -1 });

    const paidLeads = leads.filter((l) => l.commissionStatus === 'paid');
    const stats = {
      total: leads.length,
      approved: leads.filter((l) => ['approved', 'disbursed'].includes(l.status)).length,
      paid: paidLeads.length,
      paidCommission: paidLeads.reduce((s, l) => s + (l.commission || 0), 0),
      pending: leads.filter((l) => ['submitted', 'under_review', 'assigned'].includes(l.status)).length,
    };

    res.json({ agent, stats, leads: leads.slice(0, 20) });
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

    const { name, email, phone, holdPct, bankDetails } = req.body;
    if (name !== undefined) agent.name = name;
    if (phone !== undefined) agent.phone = phone;
    if (holdPct !== undefined) agent.holdPct = Math.min(100, Math.max(0, Number(holdPct) || 0));
    if (email) {
      const lower = email.toLowerCase();
      const conflict = await User.findOne({ email: lower, _id: { $ne: agent._id } });
      if (conflict) return res.status(409).json({ message: 'Email already in use' });
      agent.email = lower;
    }
    if (bankDetails !== undefined) {
      agent.bankDetails = {
        accountHolderName: bankDetails.accountHolderName ?? agent.bankDetails?.accountHolderName ?? '',
        bankName:          bankDetails.bankName          ?? agent.bankDetails?.bankName          ?? '',
        accountNumber:     bankDetails.accountNumber     ?? agent.bankDetails?.accountNumber     ?? '',
        iban:              bankDetails.iban              ?? agent.bankDetails?.iban              ?? '',
        swiftCode:         bankDetails.swiftCode         ?? agent.bankDetails?.swiftCode         ?? '',
      };
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

/**
 * GET /api/admin/agencies/pending  (admin)
 */
exports.listPendingAgencies = async (req, res) => {
  try {
    const agencies = await User.find({ role: 'agency', registrationStatus: 'pending' })
      .select('-password -inviteToken -inviteTokenExpires')
      .sort({ createdAt: -1 });
    res.json(agencies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/admin/agencies/:id/approve  (admin)
 */
exports.approveAgency = async (req, res) => {
  try {
    const agency = await User.findOne({ _id: req.params.id, role: 'agency', registrationStatus: 'pending' });
    if (!agency) return res.status(404).json({ message: 'Pending agency not found' });
    agency.isActive = true;
    agency.registrationStatus = 'approved';
    await agency.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/admin/agencies/:id/reject  (admin)
 */
exports.rejectAgency = async (req, res) => {
  try {
    const agency = await User.findOne({ _id: req.params.id, role: 'agency', registrationStatus: 'pending' });
    if (!agency) return res.status(404).json({ message: 'Pending agency not found' });
    agency.registrationStatus = 'rejected';
    await agency.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
