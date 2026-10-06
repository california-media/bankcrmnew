const Lead = require('../models/Lead');
const User = require('../models/User');

// Money/contact fields a super agent must never see on a sub-agent's lead.
// They only see their own override (SA differ), exposed as myCommission*.
const HIDDEN_ON_SUB_LEAD = [
  'phone', 'email',
  'commission', 'grossCommission', 'commissionStatus', 'commissionPaidAt', 'payoutHistory',
  'agentCommissionType', 'agentCommissionValue',
  'holdAmount', 'holdReleased', 'holdReleasedAt', 'clawbackUntil',
  'agencyPaymentStatus',
];

const redactForSuperAgent = (leadDoc) => {
  const out = leadDoc.toObject ? leadDoc.toObject() : { ...leadDoc };
  HIDDEN_ON_SUB_LEAD.forEach((f) => delete out[f]);
  if (out.agent && typeof out.agent === 'object') out.agent = { _id: out.agent._id, name: out.agent.name };
  delete out.leadNotes;
  delete out.documents;
  // Strip agent-facing payable/receivable out of populated product brackets
  ['cardProduct', 'loanProduct', 'accountProduct'].forEach((k) => {
    if (out[k] && Array.isArray(out[k].commissionBrackets)) {
      out[k] = {
        ...out[k],
        commissionBrackets: out[k].commissionBrackets.map((b) => ({
          minimumSalary: b.minimumSalary,
          agencyOverride: b.agencyOverride,
        })),
      };
    }
  });
  out.myCommission = leadDoc.agencyOverrideAmount || 0;
  out.myCommissionStatus = leadDoc.agencyOverrideStatus || 'none';
  out.myCommissionPaidAt = leadDoc.agencyOverridePaidAt;
  delete out.agencyOverrideAmount;
  delete out.agencyOverrideStatus;
  delete out.agencyOverridePaidAt;
  delete out.agencyOverrideAgency;
  delete out.superAgent;
  return out;
};

const requireSuperAgent = (req, res) => {
  if (!req.user.isSuperAgent) {
    res.status(403).json({ message: 'Super agent access only' });
    return false;
  }
  return true;
};

/** GET /api/super-agent/leads — leads submitted by my sub-agents (no contact info, no sub-agent commission) */
exports.subAgentLeads = async (req, res) => {
  try {
    if (!requireSuperAgent(req, res)) return;
    const leads = await Lead.find({ superAgent: req.user._id, status: { $ne: 'draft' } })
      .populate('bank', 'name code')
      .populate('agent', 'name')
      .populate('agency', 'name')
      .populate('cardProduct', 'name cardType')
      .populate('loanProduct', 'name loanCategory')
      .populate('accountProduct', 'name accountCategory')
      .populate('employeeStatus', 'label color')
      .sort({ updatedAt: -1 });
    res.json(leads.map(redactForSuperAgent));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** GET /api/super-agent/sub-agents — read-only list of my current sub-agents */
exports.subAgents = async (req, res) => {
  try {
    if (!requireSuperAgent(req, res)) return;
    const subs = await User.find({ superAgent: req.user._id }).select('name email phone isActive createdAt').sort({ createdAt: -1 }).lean();
    const counts = await Lead.aggregate([
      { $match: { superAgent: req.user._id, status: { $ne: 'draft' } } },
      { $group: { _id: '$agent', total: { $sum: 1 }, approved: { $sum: { $cond: [{ $in: ['$status', ['approved', 'disbursed']] }, 1, 0] } } } },
    ]);
    const by = Object.fromEntries(counts.map((c) => [String(c._id), c]));
    res.json({
      superAgentCode: req.user.superAgentCode,
      subAgents: subs.map((s) => ({
        _id: s._id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        isActive: s.isActive,
        createdAt: s.createdAt,
        totalLeads: by[String(s._id)]?.total || 0,
        approvedLeads: by[String(s._id)]?.approved || 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** GET /api/super-agent/earnings — the commission (SA differ) I earn from my sub-agents' leads */
exports.earnings = async (req, res) => {
  try {
    if (!requireSuperAgent(req, res)) return;
    const leads = await Lead.find({ agencyOverrideAgency: req.user._id })
      .populate('bank', 'name')
      .populate('agent', 'name')
      .populate('cardProduct', 'name')
      .populate('loanProduct', 'name')
      .populate('accountProduct', 'name')
      .select('leadNumber customerName status productType bank agent cardProduct loanProduct accountProduct agencyOverrideAmount agencyOverrideStatus agencyOverridePaidAt updatedAt')
      .sort({ updatedAt: -1 })
      .lean();
    const rows = leads.map((l) => ({
      _id: l._id,
      leadNumber: l.leadNumber,
      customerName: l.customerName,
      status: l.status,
      productType: l.productType,
      bank: l.bank,
      agent: l.agent ? { name: l.agent.name } : null,
      product: l.cardProduct || l.loanProduct || l.accountProduct || null,
      amount: l.agencyOverrideAmount,
      paymentStatus: l.agencyOverrideStatus,
      paidAt: l.agencyOverridePaidAt,
      updatedAt: l.updatedAt,
    }));
    const sum = (st) => rows.filter((r) => r.paymentStatus === st).reduce((a, r) => a + (r.amount || 0), 0);
    res.json({ pending: sum('pending'), paid: sum('paid'), total: sum('pending') + sum('paid'), leads: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.redactForSuperAgent = redactForSuperAgent;
