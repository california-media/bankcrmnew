const CommissionRule = require('../models/CommissionRule');
const VolumeBonus = require('../models/VolumeBonus');
const Lead = require('../models/Lead');
const CardProduct = require('../models/CardProduct');
const LoanProduct = require('../models/LoanProduct');
const AccountProduct = require('../models/AccountProduct');
const User = require('../models/User');

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

// Resolves how the submitter of this lead affects payout, gated by the
// tagging/submitting agency's agencyCommissionModel so 'wholesale' agencies
// (today's existing invoice/bucket flow) are completely unaffected:
// - overrideAgency: the lead's super agent, or (when none) set only when a plain agent (via User.agency) is tagged
//   to a 'referral'-model agency — that agency earns the per-product
//   agencyOverride on top of the agent's own payout.
// - saSelf: a super agent submitting their own lead (no middleman) — on
//   version 2+ leads they earn payable + the SA Differ.
// - selfReferral: true only when the lead's own submitter IS a 'referral'-
//   model agency (submitting its own lead directly) — that agency earns the
//   full receivable amount instead of the bracket's agent-facing payable.
async function resolveSubmitterContext(lead) {
  if (!lead.agent) return { overrideAgency: null, selfReferral: false, saSelf: false };
  // Super agent locked on the lead at submit time: it earns the product's
  // override ("SA Differ") on top of the sub-agent's own payout, whatever
  // state the super agent's account is in now.
  if (lead.superAgent) return { overrideAgency: lead.superAgent, selfReferral: false, saSelf: false };
  const submitter = await User.findById(lead.agent).select('role agency agencyCommissionModel isSuperAgent').lean();
  if (!submitter) return { overrideAgency: null, selfReferral: false, saSelf: false };
  if (submitter.role === 'agent' && submitter.isSuperAgent) return { overrideAgency: null, selfReferral: false, saSelf: true };
  if (submitter.role === 'agency') {
    return { overrideAgency: null, selfReferral: submitter.agencyCommissionModel === 'referral', saSelf: false };
  }
  if (submitter.role === 'agent' && submitter.agency) {
    const agencyDoc = await User.findById(submitter.agency).select('agencyCommissionModel').lean();
    return { overrideAgency: agencyDoc?.agencyCommissionModel === 'referral' ? submitter.agency : null, selfReferral: false, saSelf: false };
  }
  return { overrideAgency: null, selfReferral: false, saSelf: false };
}

const CURRENT_COMMISSION_RULE_VERSION = 2;
const ruleVersion = (lead) => lead.commissionRuleVersion || 1;

// Agent-facing payable for a bracket. Loans return a % of loanAmount, cards
// and accounts an AED amount. Version 2+: a super agent's own lead adds the
// SA Differ (loans: agencyOverridePct %, cards/accounts: flat agencyOverride).
function agentPayable(bracket, productType, { selfReferral, saSelf, version }) {
  if (selfReferral) return bracket.receivable;
  if (saSelf && version >= 2) {
    return bracket.payable + ((productType === 'loan' ? bracket.agencyOverridePct : bracket.agencyOverride) || 0);
  }
  return bracket.payable;
}

/**
 * Resolve both receivable (gross/admin) and payable (agent) commissions
 * from the current product brackets at call time. Used to lock values at
 * disbursement so later bracket edits don't affect already-disbursed leads.
 */
async function resolveCommissions(lead) {
  if (lead.productType === 'credit_card' && lead.cardProduct) {
    const card = await CardProduct.findById(lead.cardProduct);
    if (!card) return { receivable: 0, payable: 0, agencyOverride: 0, agencyOverrideAgency: null };
    const bracket = findBracket(card.commissionBrackets, lead.customerSalary);
    if (!bracket) return { receivable: 0, payable: 0, agencyOverride: 0, agencyOverrideAgency: null };
    const ctx = await resolveSubmitterContext(lead);
    const { overrideAgency } = ctx;
    // No tagging agency to pay it to -> the amount itself must be 0, not
    // just the recipient null, so a locked lead never shows a nonzero
    // override with nobody to receive it.
    return {
      receivable: bracket.receivable,
      payable: agentPayable(bracket, 'credit_card', { ...ctx, version: ruleVersion(lead) }),
      agencyOverride: overrideAgency ? (bracket.agencyOverride || 0) : 0,
      agencyOverrideAgency: overrideAgency,
    };
  }
  if (lead.productType === 'account' && lead.accountProduct) {
    const account = await AccountProduct.findById(lead.accountProduct);
    if (!account) return { receivable: 0, payable: 0, agencyOverride: 0, agencyOverrideAgency: null };
    const bracket = findBracket(account.commissionBrackets, lead.customerSalary);
    if (!bracket) return { receivable: 0, payable: 0, agencyOverride: 0, agencyOverrideAgency: null };
    const ctx = await resolveSubmitterContext(lead);
    const { overrideAgency } = ctx;
    return {
      receivable: bracket.receivable,
      payable: agentPayable(bracket, 'account', { ...ctx, version: ruleVersion(lead) }),
      agencyOverride: overrideAgency ? (bracket.agencyOverride || 0) : 0,
      agencyOverrideAgency: overrideAgency,
    };
  }
  if (lead.productType === 'loan' && lead.loanProduct) {
    const loan = await LoanProduct.findById(lead.loanProduct);
    if (!loan || !lead.loanAmount) return { receivable: 0, payable: 0, agencyOverride: 0, agencyOverrideAgency: null };
    const bracket = findBracket(loan.commissionBrackets, lead.customerSalary);
    if (!bracket) return { receivable: 0, payable: 0, agencyOverride: 0, agencyOverrideAgency: null };
    const ctx = await resolveSubmitterContext(lead);
    const { overrideAgency } = ctx;
    const version = ruleVersion(lead);
    // Version 2+: SA Differ on loans is a % of the loan amount; older leads
    // keep the legacy flat AED amount.
    const loanOverride = version >= 2
      ? (lead.loanAmount * (bracket.agencyOverridePct || 0)) / 100
      : (bracket.agencyOverride || 0);
    return {
      receivable: (lead.loanAmount * bracket.receivable) / 100,
      payable: (lead.loanAmount * agentPayable(bracket, 'loan', { ...ctx, version })) / 100,
      agencyOverride: overrideAgency ? loanOverride : 0,
      agencyOverrideAgency: overrideAgency,
    };
  }
  const amount = await resolveCommissionAmount({
    agency: lead.agency,
    productType: lead.productType,
    bank: lead.bank,
  });
  return { receivable: amount, payable: 0, agencyOverride: 0, agencyOverrideAgency: null };
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
    const { receivable, payable, agencyOverride, agencyOverrideAgency } = await resolveCommissions(lead);
    lead.grossCommission = receivable;
    lead.commission = payable;
    lead.agencyOverrideAmount = agencyOverride;
    lead.agencyOverrideAgency = agencyOverrideAgency;
    if (lead.commissionStatus === 'none' || lead.commissionStatus === 'paid') {
      lead.commissionStatus = 'pending';
    }
    if (agencyOverride > 0) {
      if (lead.agencyOverrideStatus === 'none' || lead.agencyOverrideStatus === 'paid') {
        lead.agencyOverrideStatus = 'pending';
      }
    } else {
      lead.agencyOverrideStatus = 'none';
    }
  } else if (lead.status === 'disbursed') {
    // Re-lock both values at disbursement (loan amount may have changed).
    // Do NOT flip commissionStatus to payable here — that happens when
    // admin marks gross commission as received from the agency.
    const { receivable, payable, agencyOverride, agencyOverrideAgency } = await resolveCommissions(lead);
    lead.grossCommission = receivable;
    lead.commission = payable;
    lead.agencyOverrideAmount = agencyOverride;
    lead.agencyOverrideAgency = agencyOverrideAgency;
  } else if (lead.status === 'rejected') {
    lead.grossCommission = 0;
    lead.commission = 0;
    lead.agencyOverrideAmount = 0;
    lead.agencyOverrideAgency = null;
    lead.commissionStatus = 'none';
    lead.agencyOverrideStatus = 'none';
  }
  return lead;
}

async function getAgentLedger(agentId) {
  const leads = await Lead.find({ agent: agentId, commissionStatus: { $ne: 'none' } })
    .populate('bank', 'name code')
    .populate('agency', 'name email')
    .populate('cardProduct', 'name cardType')
    .populate('loanProduct', 'name loanCategory')
    .populate('accountProduct', 'name accountCategory')
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
  CURRENT_COMMISSION_RULE_VERSION,
  ruleVersion,
  agentPayable,
  resolveSubmitterContext,
  resolveCommissionAmount,
  resolveCommissions,
  resolveGrossCommission,
  recalcOnStatusChange,
  getAgentLedger,
  getMonthlyBonus,
};
