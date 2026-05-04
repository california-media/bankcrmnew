const CommissionRule = require('../models/CommissionRule');
const VolumeBonus = require('../models/VolumeBonus');
const Lead = require('../models/Lead');

/**
 * Look up the AED amount earned for a given lead's product + bank.
 * Tries (productType, bank) first, falls back to (productType, null).
 * Returns 0 if no rule matches.
 */
async function resolveCommissionAmount({ productType, bank }) {
  let rule = await CommissionRule.findOne({ productType, bank });
  if (!rule) rule = await CommissionRule.findOne({ productType, bank: null });
  return rule ? rule.amount : 0;
}

/**
 * Recompute commission and commissionStatus on a Lead based on its current `status`.
 * Mutates and saves the lead. Returns the lead.
 *
 *  - approved      → commission set from rule, commissionStatus = 'pending'
 *  - disbursed     → commissionStatus = 'payable' (commission stays)
 *  - rejected      → commission = 0, commissionStatus = 'none'
 *  - others        → commission untouched (no-op)
 */
async function recalcOnStatusChange(lead) {
  if (lead.status === 'approved') {
    lead.commission = await resolveCommissionAmount({ productType: lead.productType, bank: lead.bank });
    if (lead.commissionStatus === 'none' || lead.commissionStatus === 'paid') {
      lead.commissionStatus = 'pending';
    }
  } else if (lead.status === 'disbursed') {
    if (!lead.commission) {
      lead.commission = await resolveCommissionAmount({ productType: lead.productType, bank: lead.bank });
    }
    if (lead.commissionStatus !== 'paid') lead.commissionStatus = 'payable';
  } else if (lead.status === 'rejected') {
    lead.commission = 0;
    lead.commissionStatus = 'none';
  }
  return lead;
}

/**
 * Ledger summary for an agent: totals by commissionStatus.
 */
async function getAgentLedger(agentId) {
  const leads = await Lead.find({ agent: agentId, commissionStatus: { $ne: 'none' } })
    .populate('bank', 'name code')
    .sort({ updatedAt: -1 });

  const sumBy = (s) =>
    leads.filter((l) => l.commissionStatus === s).reduce((acc, l) => acc + (l.commission || 0), 0);

  return {
    pending: sumBy('pending'),
    payable: sumBy('payable'),
    paid: sumBy('paid'),
    leads,
  };
}

/**
 * Bonus earned by an agent in a given calendar month (year, month: 0-indexed).
 * Counts leads whose status transitioned to approved/disbursed within that window.
 */
async function getMonthlyBonus(agentId, year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  const approvedCount = await Lead.countDocuments({
    agent: agentId,
    status: { $in: ['approved', 'disbursed'] },
    updatedAt: { $gte: start, $lt: end },
  });

  if (approvedCount === 0) return { approvedCount, threshold: 0, amount: 0 };

  const bonus = await VolumeBonus.findOne({ active: true, threshold: { $lte: approvedCount } })
    .sort({ threshold: -1 });

  return {
    approvedCount,
    threshold: bonus ? bonus.threshold : 0,
    amount: bonus ? bonus.amount : 0,
  };
}

module.exports = {
  resolveCommissionAmount,
  recalcOnStatusChange,
  getAgentLedger,
  getMonthlyBonus,
};
