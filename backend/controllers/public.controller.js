const User              = require('../models/User');
const Lead              = require('../models/Lead');
const Bank              = require('../models/Bank');
const CardProduct       = require('../models/CardProduct');
const LoanProduct       = require('../models/LoanProduct');
const FeaturedProduct   = require('../models/FeaturedProduct');
const AccountProduct    = require('../models/AccountProduct');
const EmployeeStatus    = require('../models/EmployeeStatus');
const commissionService = require('../services/commission.service');
const waba              = require('../services/waba.service');

/**
 * GET /api/public/ref/:code
 */
exports.getRefInfo = async (req, res) => {
  try {
    const agent = await User.findOne({ referralCode: req.params.code.toUpperCase(), role: 'agent', isActive: true }).select('name referralCode');
    if (!agent) return res.status(404).json({ message: 'Invalid referral link' });
    res.json({ agentName: agent.name, referralCode: agent.referralCode });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/public/ref/:code/draft
 * Auto-saves client info as a draft lead before product selection.
 */
exports.draftReferral = async (req, res) => {
  try {
    const agent = await User.findOne({ referralCode: req.params.code.toUpperCase(), role: 'agent', isActive: true });
    if (!agent) return res.status(404).json({ message: 'Invalid referral link' });

    const { customerName, phone, email, salary, nationality, city, companyName, jobTitle, yearsOfExperience, leadId } = req.body;
    if (!customerName || !phone || !email || salary == null) {
      return res.status(400).json({ message: 'Name, phone, email and salary are required' });
    }

    const defaultAgency = await User.findOne({ role: 'agency', isDefaultAgency: true, isActive: true }).select('_id').lean();

    const fields = {
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      customerSalary: Number(salary),
      nationality: nationality || undefined,
      city: city || undefined,
      companyName: companyName?.trim() || undefined,
      jobTitle: jobTitle?.trim() || undefined,
      yearsOfExperience: yearsOfExperience != null ? Number(yearsOfExperience) : undefined,
      agent: agent._id,
      agency: defaultAgency?._id || undefined,
      isReferral: true,
      productType: 'credit_card',
      commissionStatus: 'none',
    };

    let lead;
    if (leadId) {
      lead = await Lead.findByIdAndUpdate(leadId, { $set: fields }, { new: true });
    }
    if (!lead) {
      fields.status = 'draft';
      lead = await Lead.create(fields);
    }

    res.json({ leadId: lead._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/public/ref/:code/submit
 */
exports.submitReferral = async (req, res) => {
  try {
    const agent = await User.findOne({ referralCode: req.params.code.toUpperCase(), role: 'agent', isActive: true });
    if (!agent) return res.status(404).json({ message: 'Invalid referral link' });

    const {
      customerName, phone, email, salary, nationality, city, visaType,
      companyName, jobTitle, yearsOfExperience, notes,
      productType, cardProduct, loanProduct, loanType, loanAmount,
    } = req.body;
    if (!customerName || !phone) return res.status(400).json({ message: 'Name and phone are required' });
    if (!email) return res.status(400).json({ message: 'Email is required' });
    if (salary == null) return res.status(400).json({ message: 'Monthly salary is required' });

    const leadData = {
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      customerSalary: Number(salary),
      nationality: nationality || undefined,
      city: city || undefined,
      visaType: visaType || undefined,
      companyName: companyName?.trim() || undefined,
      jobTitle: jobTitle?.trim() || undefined,
      yearsOfExperience: yearsOfExperience != null ? Number(yearsOfExperience) : undefined,
      notes: notes?.trim() || undefined,
      productType: productType || 'credit_card',
      agent: agent._id,
      isReferral: true,
      status: 'submitted',
      commissionStatus: 'none',
    };

    let redirectUrl = null;
    // Per-product WhatsApp consent toggle — defaults true (send) unless the
    // chosen product explicitly has it off.
    let productSendConsent = true;
    if (productType === 'loan') {
      let loanCategory;
      if (loanProduct) {
        leadData.loanProduct = loanProduct;
        const loan = await LoanProduct.findById(loanProduct).select('bank agency redirectUrl redirectActive loanCategory sendConsent').lean();
        if (loan?.bank)   leadData.bank   = loan.bank;
        if (loan?.agency) leadData.agency = loan.agency;
        if (loan?.redirectActive && loan?.redirectUrl) redirectUrl = loan.redirectUrl;
        loanCategory = loan?.loanCategory;
        productSendConsent = loan?.sendConsent !== false;
      }
      // Fall back to the product's own category for the categories with
      // exactly one valid loanType (this public form has no loanType field).
      leadData.loanType = loanType || (['pos_loan', 'auto_loan'].includes(loanCategory) ? loanCategory : undefined);
      if (loanAmount) leadData.loanAmount = Number(loanAmount);
    } else {
      if (cardProduct) {
        leadData.cardProduct = cardProduct;
        const card = await CardProduct.findById(cardProduct).select('bank agency redirectUrl redirectActive sendConsent').lean();
        if (card?.bank)   leadData.bank   = card.bank;
        if (card?.agency) leadData.agency = card.agency;
        if (card?.redirectActive && card?.redirectUrl) redirectUrl = card.redirectUrl;
        productSendConsent = card?.sendConsent !== false;
      }
    }

    // Consent: auto-confirm if redirect active, else set Sent and send WhatsApp
    // (only when the product hasn't had consent sending turned off)
    if (redirectUrl) {
      const confirmedConsent = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', label: 'Confirmed' }).select('_id').lean();
      if (confirmedConsent) leadData.consentStatus = confirmedConsent._id;
    } else if (productSendConsent) {
      const sentConsent = await EmployeeStatus.findOne({ label: /^sent$/i, statusType: 'whatsapp_consent', isActive: true }).select('_id').lean();
      if (sentConsent) leadData.consentStatus = sentConsent._id;
    }

    const { receivable, payable } = await commissionService.resolveCommissions(leadData);
    leadData.grossCommission = receivable;
    leadData.commission = payable;
    leadData.status = 'submitted';

    let lead;
    if (req.body.leadId) {
      const existing = await Lead.findById(req.body.leadId).select('leadNumber').lean();
      if (existing && !existing.leadNumber) {
        const agentDoc = await User.findByIdAndUpdate(agent._id, { $inc: { leadCount: 1 } }, { new: true, select: 'leadCount' });
        const agentShortId = String(agent._id).slice(-6).toUpperCase();
        const seq = String(agentDoc.leadCount).padStart(4, '0');
        leadData.leadNumber = `LD-${agentShortId}-${seq}`;
      }
      lead = await Lead.findById(req.body.leadId);
      if (lead) {
        Object.assign(lead, leadData);
        await lead.save();
      }
    }
    if (!lead) {
      const agentDoc = await User.findByIdAndUpdate(agent._id, { $inc: { leadCount: 1 } }, { new: true, select: 'leadCount' });
      const agentShortId = String(agent._id).slice(-6).toUpperCase();
      const seq = String(agentDoc.leadCount).padStart(4, '0');
      leadData.leadNumber = `LD-${agentShortId}-${seq}`;
      lead = await Lead.create(leadData);
    }

    if (!redirectUrl && productSendConsent) {
      waba.sendConsentMessage({ phone: lead.phone, externalLeadId: lead.leadNumber || lead._id, customerName: lead.customerName, productType: lead.productType })
        .then((r) => { if (r.error || r.skipped) console.log('[WABA]', r); })
        .catch(() => {});
    }

    res.status(201).json({ message: 'Lead submitted successfully', redirectUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Ordered milestone checklist per loanType/accountType — mirrors
// frontend/src/utils/loanActions.js LOAN_MILESTONES/ACTION_LABELS exactly.
// Keep the two in sync if that file's flows change.
const LOAN_MILESTONES = {
  pdc: [{ field: 'pdcChqDone', label: 'PDC Chq' }],
  new_stl_loan: [
    { field: 'freshAccountOpenDone', label: 'Account Open' },
    { field: 'freshStlDone', label: 'STL' },
  ],
  buyout: [
    { field: 'buyoutAccountOpenDone', label: 'Account Open' },
    { field: 'buyoutLlReceivedDone', label: 'LL Received' },
    { field: 'buyoutMcSubmittedDone', label: 'MC Submitted' },
    { field: 'buyoutClReceivedDone', label: 'CL Received' },
    { field: 'buyoutStlDone', label: 'STL' },
  ],
  sme_new_loan: [{ field: 'smeAccountOpenDone', label: 'Account Open' }],
  sme_buyout_loan: [
    { field: 'smeBuyoutAccountOpenDone', label: 'Account Open' },
    { field: 'smeBuyoutLlDone', label: 'LL' },
    { field: 'smeBuyoutMcDone', label: 'MC' },
    { field: 'smeBuyoutClDone', label: 'CL' },
  ],
  pos_loan_non_bank: [
    { field: 'posPdcDone', label: 'PDC' },
    { field: 'posDdaDone', label: 'DDA' },
  ],
  pos_loan: [{ field: 'posLoanAccountOpenDone', label: 'Account Open' }],
  auto_loan: [{ field: 'carLoanRegistrationDone', label: 'Car Registration' }],
  mortgage_new: [
    { field: 'mortgageNewDocsDone', label: 'Property Mortgage Docs' },
    { field: 'mortgageNewEvaluationDone', label: 'Evaluation' },
    { field: 'mortgageNewRegistrationDone', label: 'Property Registration' },
  ],
  mortgage_buyout: [
    { field: 'mortgageBuyoutDocsDone', label: 'Property Mortgage Docs' },
    { field: 'mortgageBuyoutEvaluationDone', label: 'Evaluation' },
    { field: 'mortgageBuyoutLlDone', label: 'LL' },
    { field: 'mortgageBuyoutMcDone', label: 'MC' },
    { field: 'mortgageBuyoutClDone', label: 'CL' },
    { field: 'mortgageBuyoutRegistrationDone', label: 'Property Registration' },
  ],
};

const ACCOUNT_MILESTONES = {
  business_account: [
    { field: 'businessAccountOpenDone', label: 'Account Open' },
    { field: 'businessAccountFundCreditedDone', label: 'Fund Credited' },
  ],
  current_account: [
    { field: 'currentAccountOpenDone', label: 'Account Open' },
    { field: 'currentAccountSalaryCreditedDone', label: 'Salary Credited' },
  ],
  savings_account: [
    { field: 'savingsAccountOpenDone', label: 'Account Open' },
    { field: 'savingsFundCreditedDone', label: 'Fund Credited' },
  ],
};

// credit_card has no fixed chain — CPV/Activation/Spend are each independently
// toggled on/off per bank (Bank.hasCpv/hasActivation/hasSpend), same gating
// LeadDetail.jsx uses to decide which of the three buttons to even show.
function getActions(lead) {
  // Milestones only apply once a lead is approved — before that, CPV/
  // activation/disbursal haven't started, so hide the steps entirely
  // instead of showing them all as pending.
  if (!['approved', 'disbursed'].includes(lead.status)) return [];
  const disbursedStep = { label: 'Disbursed', done: lead.status === 'disbursed' };
  if (lead.productType === 'credit_card') {
    const steps = [];
    if (lead.bank?.hasCpv !== false) steps.push({ label: 'CPV', done: !!lead.cpvDone });
    if (lead.bank?.hasActivation !== false) steps.push({ label: 'Activated', done: !!lead.activateDone });
    if (lead.bank?.hasSpend) steps.push({ label: 'Spend', done: !!lead.spendDone });
    steps.push(disbursedStep);
    return steps;
  }
  const config = lead.accountType ? ACCOUNT_MILESTONES[lead.accountType] : LOAN_MILESTONES[lead.loanType];
  if (!config) return [disbursedStep];
  return [...config.map(({ field, label }) => ({ label, done: !!lead[field] })), disbursedStep];
}

// Bare-minimum per-IP throttle — this route is unauthenticated and its
// leadNumber format (LD-<6 hex>-<4 digit seq>) is guessable, and there's no
// app-wide rate limiter yet. In-memory only (per process, resets on deploy);
// good enough to blunt casual enumeration without adding a new dependency.
const trackStatusHits = new Map();
const TRACK_STATUS_WINDOW_MS = 5 * 60 * 1000;
const TRACK_STATUS_MAX_HITS = 12;
function isRateLimited(ip) {
  const now = Date.now();
  const hits = (trackStatusHits.get(ip) || []).filter((t) => now - t < TRACK_STATUS_WINDOW_MS);
  hits.push(now);
  trackStatusHits.set(ip, hits);
  return hits.length > TRACK_STATUS_MAX_HITS;
}

const MILESTONE_FIELDS = [
  'cpvDone', 'activateDone', 'spendDone',
  ...Object.values(LOAN_MILESTONES).flat().map((s) => s.field),
  ...Object.values(ACCOUNT_MILESTONES).flat().map((s) => s.field),
].join(' ');

/**
 * GET /api/public/track-status?leadNumber=...&firstName=...
 * No-login status lookup — matched on leadNumber + the customer's first
 * name so a bare leadNumber guess can't be used to pull someone else's data.
 * Only non-sensitive fields are returned: no PII beyond the first name
 * already used to authenticate the lookup, no commission/payout data, no
 * internal notes or employee assignments — see the neverExpose list this
 * was reviewed against.
 */
exports.trackStatus = async (req, res) => {
  try {
    if (isRateLimited(req.ip)) {
      return res.status(429).json({ message: 'Too many attempts. Please try again later.' });
    }

    const { leadNumber, firstName } = req.query;
    if (!leadNumber || !firstName) {
      return res.status(400).json({ message: 'Reference number and first name are required' });
    }

    const lead = await Lead.findOne({ leadNumber: leadNumber.trim().toUpperCase() })
      .select(`leadNumber customerName status productType loanType accountType loanAmount
                bank cardProduct loanProduct accountProduct statusHistory createdAt updatedAt
                ${MILESTONE_FIELDS}`)
      .populate('bank', 'name hasCpv hasActivation hasSpend')
      .populate('cardProduct', 'name cardType')
      .populate('loanProduct', 'name')
      .populate('accountProduct', 'name')
      .lean();

    const firstNameMatches = lead?.customerName?.trim().split(/\s+/)[0]?.toLowerCase() === firstName.trim().toLowerCase();
    if (!lead || !firstNameMatches) {
      return res.status(404).json({ message: 'No application found matching that reference number and first name' });
    }

    // statusHistory also logs milestone-action events (e.g. 'cpv_done',
    // 'buyout_stl_done') under the same `status` key — those aren't lead
    // lifecycle states and duplicate what `actions` already shows, so the
    // public timeline keeps only genuine status transitions.
    const history = (lead.statusHistory || [])
      .filter((h) => Lead.STATUSES.includes(h.status))
      .map((h) => ({ status: h.status, changedAt: h.changedAt }));

    res.json({
      leadNumber: lead.leadNumber,
      customerName: lead.customerName,
      status: lead.status,
      productType: lead.productType,
      loanType: lead.loanType || undefined,
      accountType: lead.accountType || undefined,
      bankName: lead.bank?.name,
      productName: lead.cardProduct?.name || lead.loanProduct?.name || lead.accountProduct?.name,
      cardType: lead.cardProduct?.cardType || undefined,
      loanAmount: lead.productType === 'loan' ? lead.loanAmount : undefined,
      submittedAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      actions: getActions(lead),
      history,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// `?referralOnly=1` (used only by the /ref/:code referral form) narrows to
// referralVisible products/banks; every other existing caller is unaffected
// since the flag defaults off.
exports.getPublicBanks = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.referralOnly) {
      // referralVisible is independent from websiteVisible on purpose — a
      // product hidden from the marketing website can still be shown here.
      const [cardBankIds, loanBankIds] = await Promise.all([
        CardProduct.distinct('bank', { isActive: true, referralVisible: true }),
        LoanProduct.distinct('bank', { isActive: true, referralVisible: true }),
      ]);
      filter._id = { $in: [...cardBankIds, ...loanBankIds] };
    }
    const banks = await Bank.find(filter).select('name').sort('name').lean();
    res.json(banks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPublicCardProducts = async (req, res) => {
  try {
    // referralOnly bypasses websiteVisible on purpose — referral-form
    // visibility is independent from marketing-website visibility.
    const filter = req.query.referralOnly
      ? { isActive: true, referralVisible: true }
      : { isActive: true, websiteVisible: { $ne: false } };
    const cards = await CardProduct.find(filter)
      .populate({ path: 'bank', select: 'name isActive' })
      .populate({ path: 'cashbackCategories.category', select: 'name' })
      .select('name cardType cardImage commissionBrackets bank benefits feesEligibility keyFeatures cashbackCategories rewardBadges redirectUrl redirectActive referralVisible rate kfsUrl tncUrl')
      .lean();
    res.json(cards.filter(c => c.bank?.isActive !== false));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPublicFeaturedProducts = async (req, res) => {
  try {
    const products = await FeaturedProduct.find({ isVisible: { $ne: false } })
      .sort({ order: 1, createdAt: 1 })
      .lean();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.submitWebApply = async (req, res) => {
  try {
    const { customerName, phone, email, salary, city, nationality, cardProductId } = req.body;
    if (!customerName || !phone) return res.status(400).json({ message: 'Name and phone are required' });
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const leadData = {
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      customerSalary: salary ? Number(salary) : undefined,
      city: city || undefined,
      nationality: nationality || undefined,
      productType: 'credit_card',
      isReferral: false,
      source: 'web_apply',
      status: 'submitted',
      commissionStatus: 'none',
      grossCommission: 0,
      commission: 0,
    };

    // Always assign to the default agency regardless of which card is selected
    const agencyDoc = await User.findOneAndUpdate(
      { role: 'agency', isDefaultAgency: true, isActive: true },
      { $inc: { leadCount: 1 } },
      { new: true, select: '_id leadCount' }
    );
    if (agencyDoc) {
      leadData.agency = agencyDoc._id;
      const shortId = String(agencyDoc._id).slice(-6).toUpperCase();
      const seq = String(agencyDoc.leadCount).padStart(4, '0');
      leadData.leadNumber = `LD-${shortId}-${seq}`;
    }

    let redirectUrl = null;
    let productSendConsent = true;
    if (cardProductId) {
      leadData.cardProduct = cardProductId;
      const card = await CardProduct.findById(cardProductId).select('bank redirectUrl redirectActive sendConsent').lean();
      if (card?.bank) leadData.bank = card.bank;
      if (card?.redirectActive && card?.redirectUrl) redirectUrl = card.redirectUrl;
      productSendConsent = card?.sendConsent !== false;
    }

    if (redirectUrl) {
      const confirmedConsent = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', label: 'Confirmed' }).select('_id').lean();
      if (confirmedConsent) leadData.consentStatus = confirmedConsent._id;
    } else if (productSendConsent) {
      const sentConsent = await EmployeeStatus.findOne({ label: /^sent$/i, statusType: 'whatsapp_consent', isActive: true }).select('_id').lean();
      if (sentConsent) leadData.consentStatus = sentConsent._id;
    }

    const lead = await Lead.create(leadData);

    if (!redirectUrl && productSendConsent) {
      waba.sendConsentMessage({ phone: lead.phone, externalLeadId: lead.leadNumber || lead._id, customerName: lead.customerName, productType: lead.productType })
        .then((r) => { if (r.error || r.skipped) console.log('[WABA]', r); })
        .catch(() => {});
    }

    res.status(201).json({ message: 'Application submitted successfully', redirectUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.submitWebLoanApply = async (req, res) => {
  try {
    const { customerName, phone, email, salary, loanAmount, employmentStatus, loanProductId, loanType } = req.body;
    if (!customerName || !phone) return res.status(400).json({ message: 'Name and phone are required' });
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const leadData = {
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      customerSalary: salary ? Number(salary) : undefined,
      loanAmount: loanAmount ? Number(loanAmount) : undefined,
      notes: employmentStatus ? `Employment: ${employmentStatus}` : undefined,
      productType: 'loan',
      isReferral: false,
      source: 'web_apply',
      status: 'submitted',
      commissionStatus: 'none',
      grossCommission: 0,
      commission: 0,
    };
    const ALLOWED_LOAN_TYPES = Lead.schema.path('loanType').enumValues;
    if (loanType && ALLOWED_LOAN_TYPES.includes(loanType)) leadData.loanType = loanType;

    const agencyDoc = await User.findOneAndUpdate(
      { role: 'agency', isDefaultAgency: true, isActive: true },
      { $inc: { leadCount: 1 } },
      { new: true, select: '_id leadCount' }
    );
    if (agencyDoc) {
      leadData.agency = agencyDoc._id;
      const shortId = String(agencyDoc._id).slice(-6).toUpperCase();
      const seq = String(agencyDoc.leadCount).padStart(4, '0');
      leadData.leadNumber = `LD-${shortId}-${seq}`;
    }

    let loanRedirectUrl = null;
    let productSendConsent = true;
    if (loanProductId) {
      leadData.loanProduct = loanProductId;
      const loan = await LoanProduct.findById(loanProductId).select('bank redirectUrl redirectActive loanCategory sendConsent').lean();
      if (loan?.bank) leadData.bank = loan.bank;
      if (loan?.redirectActive && loan?.redirectUrl) loanRedirectUrl = loan.redirectUrl;
      // Fall back to the product's own category for the categories with
      // exactly one valid loanType (this public form has no loanType field).
      if (!leadData.loanType && ['pos_loan', 'auto_loan'].includes(loan?.loanCategory)) {
        leadData.loanType = loan.loanCategory;
      }
      productSendConsent = loan?.sendConsent !== false;
    }

    if (loanRedirectUrl) {
      const confirmedConsent = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', label: 'Confirmed' }).select('_id').lean();
      if (confirmedConsent) leadData.consentStatus = confirmedConsent._id;
    } else if (productSendConsent) {
      const sentConsent = await EmployeeStatus.findOne({ label: /^sent$/i, statusType: 'whatsapp_consent', isActive: true }).select('_id').lean();
      if (sentConsent) leadData.consentStatus = sentConsent._id;
    }

    const lead = await Lead.create(leadData);

    if (!loanRedirectUrl && productSendConsent) {
      waba.sendConsentMessage({ phone: lead.phone, externalLeadId: lead.leadNumber || lead._id, customerName: lead.customerName, productType: lead.productType })
        .then((r) => { if (r.error || r.skipped) console.log('[WABA]', r); })
        .catch(() => {});
    }

    res.status(201).json({ message: 'Application submitted successfully', redirectUrl: loanRedirectUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPublicLoanProducts = async (req, res) => {
  try {
    // referralOnly bypasses websiteVisible on purpose — referral-form
    // visibility is independent from marketing-website visibility.
    const filter = req.query.referralOnly
      ? { isActive: true, referralVisible: true }
      : { isActive: true, websiteVisible: { $ne: false } };
    const loans = await LoanProduct.find(filter)
      .populate({ path: 'bank', select: 'name code logo isActive' })
      .select('name loanCategory commissionBrackets bank benefits feesEligibility interestRateRange minSalary maxLoanAmount maxTenure keyNotes rateMin rateMax rateType rateBasis salaryTransferRequired tags processingFee earlySettlement lateFee maxAmountNote maxAmountNum disclosedNote source sourceLabel tenureMaxMonths loanType minTurnover collateralRequired minPosHistoryMonths redirectUrl redirectActive referralVisible')
      .lean();
    res.json(loans.filter(l => l.bank?.isActive !== false));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPublicAccountProducts = async (req, res) => {
  try {
    const accounts = await AccountProduct.find({ isActive: true, websiteVisible: { $ne: false } })
      .populate({ path: 'bank', select: 'name code logo isActive' })
      .select('name accountCategory commissionBrackets bank benefits feesEligibility minBalance monthlyFee interestRate rateMin rateMax keyNotes tags type digitalOnboarding multiCurrency salaryTransferRequired freeTransactions fallBelowFee payoutFrequency redirectUrl redirectActive')
      .lean();
    res.json(accounts.filter(a => a.bank?.isActive !== false));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.submitWebAccountApply = async (req, res) => {
  try {
    const { customerName, phone, email, salary, accountType, accountProductId } = req.body;
    if (!customerName || !phone) return res.status(400).json({ message: 'Name and phone are required' });
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const leadData = {
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      customerSalary: salary ? Number(salary) : undefined,
      productType: 'account',
      isReferral: false,
      source: 'web_apply',
      status: 'submitted',
      commissionStatus: 'none',
      grossCommission: 0,
      commission: 0,
    };
    const ALLOWED_ACCOUNT_TYPES = Lead.schema.path('accountType').enumValues;
    if (accountType && ALLOWED_ACCOUNT_TYPES.includes(accountType)) leadData.accountType = accountType;

    const agencyDoc = await User.findOneAndUpdate(
      { role: 'agency', isDefaultAgency: true, isActive: true },
      { $inc: { leadCount: 1 } },
      { new: true, select: '_id leadCount' }
    );
    if (agencyDoc) {
      leadData.agency = agencyDoc._id;
      const shortId = String(agencyDoc._id).slice(-6).toUpperCase();
      const seq = String(agencyDoc.leadCount).padStart(4, '0');
      leadData.leadNumber = `LD-${shortId}-${seq}`;
    }

    let accountRedirectUrl = null;
    let productSendConsent = true;
    if (accountProductId) {
      leadData.accountProduct = accountProductId;
      const account = await AccountProduct.findById(accountProductId).select('bank redirectUrl redirectActive sendConsent').lean();
      if (account?.bank) leadData.bank = account.bank;
      if (account?.redirectActive && account?.redirectUrl) accountRedirectUrl = account.redirectUrl;
      productSendConsent = account?.sendConsent !== false;
    }

    if (accountRedirectUrl) {
      const confirmedConsent = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', label: 'Confirmed' }).select('_id').lean();
      if (confirmedConsent) leadData.consentStatus = confirmedConsent._id;
    } else if (productSendConsent) {
      const sentConsent = await EmployeeStatus.findOne({ label: /^sent$/i, statusType: 'whatsapp_consent', isActive: true }).select('_id').lean();
      if (sentConsent) leadData.consentStatus = sentConsent._id;
    }

    const lead = await Lead.create(leadData);

    if (!accountRedirectUrl && productSendConsent) {
      waba.sendConsentMessage({ phone: lead.phone, externalLeadId: lead.leadNumber || lead._id, customerName: lead.customerName, productType: lead.productType })
        .then((r) => { if (r.error || r.skipped) console.log('[WABA]', r); })
        .catch(() => {});
    }

    res.status(201).json({ message: 'Application submitted successfully', redirectUrl: accountRedirectUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
