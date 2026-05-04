const Lead = require('../models/Lead');
const Bank = require('../models/Bank');
const User = require('../models/User');
const commissionService = require('../services/commission.service');

/**
 * POST /api/leads  (agent)
 * Body: { customerName, phone, productType, bank, notes? }
 * The lead is created with status='submitted' and agency=null. Any agency
 * whose `banks` contains lead.bank may pick it up.
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
      status: 'submitted',
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
 * Count summary used on the agent dashboard.
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

    const activeStatuses = ['submitted', 'assigned_to_bank', 'under_review'];
    const active = leads.filter((l) => activeStatuses.includes(l.status)).length;
    const pending = leads.filter((l) => l.status === 'submitted' || l.status === 'under_review').length;
    const paidEarnings = leads
      .filter((l) => l.commissionStatus === 'paid')
      .reduce((s, l) => s + (l.commission || 0), 0);
    const pendingEarnings = leads
      .filter((l) => l.commissionStatus === 'pending' || l.commissionStatus === 'payable')
      .reduce((s, l) => s + (l.commission || 0), 0);

    res.json({
      total, active, approved, rejected, pending, disbursed,
      paidEarnings, pendingEarnings,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/leads/agency  (agency)
 * Leads where bank ∈ agency.banks AND (agency is null OR self).
 */
exports.listForAgency = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select('banks');
    const filter = {
      bank: { $in: me.banks || [] },
      $or: [{ agency: null }, { agency: req.user._id }],
    };
    const leads = await Lead.find(filter)
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
 * All leads with full population.
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
  agency: ['under_review', 'assigned_to_bank', 'approved', 'rejected', 'disbursed'],
  admin: Lead.STATUSES,
};

/**
 * PATCH /api/leads/:id/status  (agency, admin)
 * Body: { status: LeadStatus }
 * - Agency: claims the lead (sets agency=self) if it was unassigned. Can only act on own/unclaimed.
 * - Triggers commission recalculation via commission.service.
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
      const me = await User.findById(req.user._id).select('banks');
      const bankAllowed = (me.banks || []).some((b) => String(b) === String(lead.bank));
      if (!bankAllowed) return res.status(403).json({ message: 'This lead is not for your banks' });

      const claimed = lead.agency && String(lead.agency) !== String(req.user._id);
      if (claimed) return res.status(409).json({ message: 'Lead has been claimed by another agency' });

      lead.agency = req.user._id;
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
 * Moves a lead's commission from 'payable' to 'paid'.
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
 * Detailed commission ledger for the calling agent + current-month bonus snapshot.
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
