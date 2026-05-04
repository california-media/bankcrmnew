const Lead = require('../models/Lead');
const Bank = require('../models/Bank');
const User = require('../models/User');
const commissionService = require('../services/commission.service');

/**
 * POST /api/leads  (agent)
 * Body: { customerName, phone, productType, bank, notes? }
 * Creates a draft lead — the agent picks an agency in a separate step
 * via POST /api/leads/:id/send-to-agency.
 */
exports.create = async (req, res) => {
  try {
    const { customerName, phone, productType, bank, notes } = req.body;
    if (!customerName || !phone || !productType || !bank) {
      return res.status(400).json({ message: 'customerName, phone, productType, and bank are required' });
    }

    const bankExists = await Bank.findById(bank);
    if (!bankExists) return res.status(400).json({ message: 'Invalid bank' });

    const lead = await Lead.create({
      customerName,
      phone,
      productType,
      bank,
      notes,
      agent: req.user._id,
      status: 'draft',
      agency: null,
    });
    const populated = await lead.populate([
      { path: 'bank', select: 'name code' },
      { path: 'agent', select: 'name email' },
    ]);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/leads/:id/send-to-agency  (agent)
 * Body: { agency: ObjectId }
 * Promotes a draft lead by attaching an agency. The agency must service
 * the lead's bank. After this, status='submitted' and the agency's queue picks it up.
 */
exports.sendToAgency = async (req, res) => {
  try {
    const { agency } = req.body;
    if (!agency) return res.status(400).json({ message: 'agency is required' });

    const lead = await Lead.findOne({ _id: req.params.id, agent: req.user._id });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (lead.status !== 'draft') {
      return res.status(400).json({ message: 'Only draft leads can be sent to an agency' });
    }

    const agencyDoc = await User.findOne({ _id: agency, role: 'agency', isActive: true });
    if (!agencyDoc) return res.status(400).json({ message: 'Invalid agency' });
    const agencyHasBank = (agencyDoc.banks || []).some((b) => String(b) === String(lead.bank));
    if (!agencyHasBank) return res.status(400).json({ message: 'Selected agency does not service this bank' });

    lead.agency = agency;
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
 * Lets the agent discard one of their own draft leads.
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
 * Includes a `drafts` count so the dashboard can prompt the agent to send them.
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

const ALLOWED_TRANSITIONS = {
  agency: ['under_review', 'assigned', 'approved', 'rejected', 'disbursed'],
  admin: Lead.STATUSES,
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
    const allowed = ALLOWED_TRANSITIONS[req.user.role];
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
