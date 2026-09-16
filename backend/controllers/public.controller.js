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
      lead = await Lead.findByIdAndUpdate(req.body.leadId, { $set: leadData }, { new: true });
    }
    if (!lead) {
      const agentDoc = await User.findByIdAndUpdate(agent._id, { $inc: { leadCount: 1 } }, { new: true, select: 'leadCount' });
      const agentShortId = String(agent._id).slice(-6).toUpperCase();
      const seq = String(agentDoc.leadCount).padStart(4, '0');
      leadData.leadNumber = `LD-${agentShortId}-${seq}`;
      lead = await Lead.create(leadData);
    }

    if (!redirectUrl && productSendConsent) {
      waba.sendConsentMessage({ phone: lead.phone, externalLeadId: lead.leadNumber || lead._id, customerName: lead.customerName })
        .then((r) => { if (r.error || r.skipped) console.log('[WABA]', r); })
        .catch(() => {});
    }

    res.status(201).json({ message: 'Lead submitted successfully', redirectUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPublicBanks = async (req, res) => {
  try {
    const banks = await Bank.find({ isActive: true }).select('name').sort('name').lean();
    res.json(banks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPublicCardProducts = async (req, res) => {
  try {
    const cards = await CardProduct.find({ isActive: true, websiteVisible: { $ne: false } })
      .populate({ path: 'bank', select: 'name isActive' })
      .populate({ path: 'cashbackCategories.category', select: 'name' })
      .select('name cardType cardImage commissionBrackets bank benefits feesEligibility keyFeatures cashbackCategories rewardBadges redirectUrl redirectActive rate kfsUrl tncUrl')
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
      waba.sendConsentMessage({ phone: lead.phone, externalLeadId: lead.leadNumber || lead._id, customerName: lead.customerName })
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
      waba.sendConsentMessage({ phone: lead.phone, externalLeadId: lead.leadNumber || lead._id, customerName: lead.customerName })
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
    const loans = await LoanProduct.find({ isActive: true, websiteVisible: { $ne: false } })
      .populate({ path: 'bank', select: 'name code logo isActive' })
      .select('name loanCategory commissionBrackets bank benefits feesEligibility interestRateRange minSalary maxLoanAmount maxTenure keyNotes rateMin rateMax rateType rateBasis salaryTransferRequired tags processingFee earlySettlement lateFee maxAmountNote maxAmountNum disclosedNote source sourceLabel tenureMaxMonths loanType minTurnover collateralRequired minPosHistoryMonths redirectUrl redirectActive')
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
      waba.sendConsentMessage({ phone: lead.phone, externalLeadId: lead.leadNumber || lead._id, customerName: lead.customerName })
        .then((r) => { if (r.error || r.skipped) console.log('[WABA]', r); })
        .catch(() => {});
    }

    res.status(201).json({ message: 'Application submitted successfully', redirectUrl: accountRedirectUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
