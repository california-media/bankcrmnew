const Lead = require('../models/Lead');
const Bank = require('../models/Bank');
const User = require('../models/User');
const commissionService = require('../services/commission.service');

/**
 * POST /api/leads  (agent)
 * Body: { customerName, phone, productType, notes? }
 * Creates a draft lead (no agency, no bank yet — both chosen at send-to-agency).
 */
exports.create = async (req, res) => {
  try {
    const { customerName, phone, productType, notes } = req.body;
    if (!customerName || !phone || !productType) {
      return res.status(400).json({ message: 'customerName, phone, and productType are required' });
    }

    const lead = await Lead.create({
      customerName,
      phone,
      productType,
      notes,
      agent: req.user._id,
      status: 'draft',
    });
    const populated = await lead.populate('agent', 'name email');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/leads/:id/send-to-agency  (agent, admin)
 * Body: { agency: ObjectId, bank: ObjectId }
 * The bank must belong to the chosen agency. Agents may only send their own
 * drafts; admins may send any draft on behalf of the agent who created it.
 */
exports.sendToAgency = async (req, res) => {
  try {
    const { agency, bank } = req.body;
    if (!agency || !bank) return res.status(400).json({ message: 'agency and bank are required' });

    const filter = { _id: req.params.id };
    if (req.user.role === 'agent') filter.agent = req.user._id;
    const lead = await Lead.findOne(filter);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (lead.status !== 'draft') {
      return res.status(400).json({ message: 'Only draft leads can be sent to an agency' });
    }

    const agencyDoc = await User.findOne({ _id: agency, role: 'agency', isActive: true });
    if (!agencyDoc) return res.status(400).json({ message: 'Invalid agency' });

    const bankDoc = await Bank.findOne({ _id: bank, agency: agencyDoc._id });
    if (!bankDoc) return res.status(400).json({ message: 'Bank does not belong to that agency' });

    lead.agency = agency;
    lead.bank = bank;
    lead.status = 'submitted';
    await lead.save();

    const populated = await lead.populate([
      { path: 'bank', select: 'name code' },
      { path: 'agent', select: 'name email' },
      { path: 'agency', select: 'name email' },
    ]);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /api/leads/:id  (agent)
 */
exports.removeDraft = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, agent: req.user._id });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (lead.status !== 'draft') {
      return res.status(400).json({ message: 'Only draft leads can be deleted' });
    }
    await lead.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/leads/mine  (agent)
 */
exports.listMine = async (req, res) => {
  try {
    const leads = await Lead.find({ agent: req.user._id })
      .populate('bank', 'name code')
      .populate('agency', 'name email')
      .sort({ createdAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/leads/stats  (agent)
 */
exports.stats = async (req, res) => {
  try {
    const agentId = req.user._id;
    const [total, approved, rejected, disbursed, leads] = await Promise.all([
      Lead.countDocuments({ agent: agentId }),
      Lead.countDocuments({ agent: agentId, status: 'approved' }),
      Lead.countDocuments({ agent: agentId, status: 'rejected' }),
      Lead.countDocuments({ agent: agentId, status: 'disbursed' }),
      Lead.find({ agent: agentId }).select('status commission commissionStatus'),
    ]);

    const activeStatuses = ['draft', 'submitted', 'under_review', 'assigned'];
    const active = leads.filter((l) => activeStatuses.includes(l.status)).length;
    const drafts = leads.filter((l) => l.status === 'draft').length;
    const pending = leads.filter((l) => l.status === 'submitted' || l.status === 'under_review').length;
    const paidEarnings = leads
      .filter((l) => l.commissionStatus === 'paid')
      .reduce((s, l) => s + (l.commission || 0), 0);
    const pendingEarnings = leads
      .filter((l) => l.commissionStatus === 'pending' || l.commissionStatus === 'payable')
      .reduce((s, l) => s + (l.commission || 0), 0);

    res.json({
      total, active, drafts, approved, rejected, pending, disbursed,
      paidEarnings, pendingEarnings,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/leads/agency  (agency)
 */
exports.listForAgency = async (req, res) => {
  try {
    const leads = await Lead.find({ agency: req.user._id })
      .populate('bank', 'name code')
      .populate('agent', 'name email phone')
      .sort({ createdAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/leads  (admin)
 */
exports.listAll = async (req, res) => {
  try {
    const leads = await Lead.find()
      .populate('bank', 'name code')
      .populate('agent', 'name email')
      .populate('agency', 'name email')
      .sort({ createdAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Allowed FROM-states for each TO-status.
 *  - approve: only after assigned
 *  - reject:  any non-terminal
 *  - others enforce sensible forward motion
 * Admins can bypass these for anything except draft (kept agent-only).
 */
const FROM_STATES = {
  under_review: ['submitted'],
  assigned: ['under_review'],
  approved: ['assigned'],
  rejected: ['submitted', 'under_review', 'assigned', 'approved'],
  disbursed: ['approved'],
};

const ROLE_TARGETS = {
  agency: ['under_review', 'assigned', 'approved', 'rejected', 'disbursed'],
  admin: ['under_review', 'assigned', 'approved', 'rejected', 'disbursed', 'submitted'],
};

/**
 * PATCH /api/leads/:id/status  (agency, admin)
 */
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !Lead.STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const allowed = ROLE_TARGETS[req.user.role];
    if (!allowed || !allowed.includes(status)) {
      return res.status(403).json({ message: 'You may not set this status' });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (req.user.role === 'agency') {
      if (!lead.agency || String(lead.agency) !== String(req.user._id)) {
        return res.status(403).json({ message: 'This lead is not assigned to you' });
      }
    }

    const allowedFrom = FROM_STATES[status];
    if (allowedFrom && !allowedFrom.includes(lead.status)) {
      return res.status(400).json({
        message: `Cannot move from "${lead.status}" to "${status}"`,
      });
    }

    lead.status = status;
    await commissionService.recalcOnStatusChange(lead);
    await lead.save();

    const populated = await lead.populate([
      { path: 'bank', select: 'name code' },
      { path: 'agent', select: 'name email phone' },
      { path: 'agency', select: 'name email' },
    ]);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/leads/:id/mark-paid  (admin)
 */
exports.markCommissionPaid = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (lead.commissionStatus !== 'payable') {
      return res.status(400).json({ message: 'Commission is not payable' });
    }
    lead.commissionStatus = 'paid';
    lead.commissionPaidAt = new Date();
    await lead.save();
    const populated = await lead.populate([
      { path: 'bank', select: 'name code' },
      { path: 'agent', select: 'name email' },
    ]);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/leads/ledger  (agent)
 */
exports.myLedger = async (req, res) => {
  try {
    const ledger = await commissionService.getAgentLedger(req.user._id);
    const now = new Date();
    const bonus = await commissionService.getMonthlyBonus(req.user._id, now.getFullYear(), now.getMonth());
    res.json({ ...ledger, monthlyBonus: bonus });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
