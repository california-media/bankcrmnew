const CommissionRule = require('../models/CommissionRule');
const VolumeBonus = require('../models/VolumeBonus');
const Lead = require('../models/Lead');
const CardProduct = require('../models/CardProduct');
const LoanProduct = require('../models/LoanProduct');

async function resolveCommissionAmount({ agency, productType, bank }) {
  if (!agency || !bank) return 0;
  const rule = await CommissionRule.findOne({ agency, productType, bank });
  return rule ? rule.amount : 0;
}

/**
 * Calculate gross commission for a lead based on its product type.
 * Card: fixed commissionAmount from CardProduct.
 * Loan: commissionRate % of loanAmount.
 * Falls back to CommissionRule if no product is linked.
 */
function findBracket(brackets, salary) {
  if (!brackets || brackets.length === 0) return null;
  const sorted = [...brackets].sort((a, b) => a.minimumSalary - b.minimumSalary);
  if (!salary) return sorted[0];
  const eligible = sorted.filter((b) => b.minimumSalary <= salary);
  return eligible.length ? eligible[eligible.length - 1] : sorted[0];
}

/**
 * Resolve both receivable (gross/admin) and payable (agent) commissions
 * from the current product brackets at call time. Used to lock values at
 * disbursement so later bracket edits don't affect already-disbursed leads.
 */
async function resolveCommissions(lead) {
  if (lead.productType === 'credit_card' && lead.cardProduct) {
    const card = await CardProduct.findById(lead.cardProduct);
    if (!card) return { receivable: 0, payable: 0 };
    const bracket = findBracket(card.commissionBrackets, lead.customerSalary);
    return bracket
      ? { receivable: bracket.receivable, payable: bracket.payable }
      : { receivable: 0, payable: 0 };
  }
  if (lead.productType === 'loan' && lead.loanProduct) {
    const loan = await LoanProduct.findById(lead.loanProduct);
    if (!loan || !lead.loanAmount) return { receivable: 0, payable: 0 };
    const bracket = findBracket(loan.commissionBrackets, lead.customerSalary);
    if (!bracket) return { receivable: 0, payable: 0 };
    return {
      receivable: (lead.loanAmount * bracket.receivable) / 100,
      payable: (lead.loanAmount * bracket.payable) / 100,
    };
  }
  const amount = await resolveCommissionAmount({
    agency: lead.agency,
    productType: lead.productType,
    bank: lead.bank,
  });
  return { receivable: amount, payable: 0 };
}

async function resolveGrossCommission(lead) {
  const { receivable } = await resolveCommissions(lead);
  return receivable;
}

async function recalcOnStatusChange(lead) {
  if (lead.status === 'approved') {
    // Lock both gross and agent commission at approval time so figures are
    // visible in admin Payouts immediately. Disbursement re-locks them in
    // case loan amount changed between approval and disbursal.
    const { receivable, payable } = await resolveCommissions(lead);
    lead.grossCommission = receivable;
    lead.commission = payable;
    if (lead.commissionStatus === 'none' || lead.commissionStatus === 'paid') {
      lead.commissionStatus = 'pending';
    }
  } else if (lead.status === 'disbursed') {
    // Re-lock both values at disbursement (loan amount may have changed).
    // Do NOT flip commissionStatus to payable here — that happens when
    // admin marks gross commission as received from the agency.
    const { receivable, payable } = await resolveCommissions(lead);
    lead.grossCommission = receivable;
    lead.commission = payable;
  } else if (lead.status === 'rejected') {
    lead.grossCommission = 0;
    lead.commission = 0;
    lead.commissionStatus = 'none';
  }
  return lead;
}

async function getAgentLedger(agentId) {
  const leads = await Lead.find({ agent: agentId, commissionStatus: { $ne: 'none' } })
    .populate('bank', 'name code')
    .populate('agency', 'name email')
    .populate('cardProduct', 'name cardType')
    .populate('loanProduct', 'name loanCategory')
    .sort({ updatedAt: -1 });

  const sumBy = (s) =>
    leads.filter((l) => l.commissionStatus === s).reduce((acc, l) => acc + (l.commission || 0), 0);

  // paid = actual received (commission minus unreleased hold)
  const paidActual = leads
    .filter((l) => l.commissionStatus === 'paid')
    .reduce((acc, l) => {
      const unreleased = (!l.holdReleased && l.holdAmount > 0) ? (l.holdAmount || 0) : 0;
      return acc + (l.commission || 0) - unreleased;
    }, 0);

  const held = leads
    .filter((l) => l.holdAmount > 0 && !l.holdReleased && l.productType === 'credit_card')
    .reduce((acc, l) => acc + (l.holdAmount || 0), 0);

  return {
    pending: sumBy('pending'),
    payable: sumBy('payable'),
    paid: paidActual,
    held,
    leads,
  };
}

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
  resolveCommissions,
  resolveGrossCommission,
  recalcOnStatusChange,
  getAgentLedger,
  getMonthlyBonus,
};
