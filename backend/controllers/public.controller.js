const User              = require('../models/User');
const Lead              = require('../models/Lead');
const Bank              = require('../models/Bank');
const CardProduct       = require('../models/CardProduct');
const LoanProduct       = require('../models/LoanProduct');
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
    if (productType === 'loan') {
      if (loanProduct) {
        leadData.loanProduct = loanProduct;
        const loan = await LoanProduct.findById(loanProduct).select('bank agency redirectUrl redirectActive').lean();
        if (loan?.bank)   leadData.bank   = loan.bank;
        if (loan?.agency) leadData.agency = loan.agency;
        if (loan?.redirectActive && loan?.redirectUrl) redirectUrl = loan.redirectUrl;
      }
      if (loanType)   leadData.loanType   = loanType;
      if (loanAmount) leadData.loanAmount = Number(loanAmount);
    } else {
      if (cardProduct) {
        leadData.cardProduct = cardProduct;
        const card = await CardProduct.findById(cardProduct).select('bank agency redirectUrl redirectActive').lean();
        if (card?.bank)   leadData.bank   = card.bank;
        if (card?.agency) leadData.agency = card.agency;
        if (card?.redirectActive && card?.redirectUrl) redirectUrl = card.redirectUrl;
      }
    }

    // Consent: auto-confirm if redirect active, else set Sent and send WhatsApp
    if (redirectUrl) {
      const confirmedConsent = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', label: 'Confirmed' }).select('_id').lean();
      if (confirmedConsent) leadData.consentStatus = confirmedConsent._id;
    } else {
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

    if (!redirectUrl) {
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
    const cards = await CardProduct.find({ isActive: true })
      .populate({ path: 'bank', select: 'name isActive' })
      .populate({ path: 'cashbackCategories.category', select: 'name' })
      .select('name cardType cardImage commissionBrackets bank benefits feesEligibility keyFeatures cashbackCategories redirectUrl redirectActive rate')
      .lean();
    res.json(cards.filter(c => c.bank?.isActive !== false));
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
    if (cardProductId) {
      leadData.cardProduct = cardProductId;
      const card = await CardProduct.findById(cardProductId).select('bank redirectUrl redirectActive').lean();
      if (card?.bank) leadData.bank = card.bank;
      if (card?.redirectActive && card?.redirectUrl) redirectUrl = card.redirectUrl;
    }

    if (redirectUrl) {
      const confirmedConsent = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', label: 'Confirmed' }).select('_id').lean();
      if (confirmedConsent) leadData.consentStatus = confirmedConsent._id;
    } else {
      const sentConsent = await EmployeeStatus.findOne({ label: /^sent$/i, statusType: 'whatsapp_consent', isActive: true }).select('_id').lean();
      if (sentConsent) leadData.consentStatus = sentConsent._id;
    }

    const lead = await Lead.create(leadData);

    if (!redirectUrl) {
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
    const { customerName, phone, email, salary, loanAmount, employmentStatus, loanProductId } = req.body;
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
    if (loanProductId) {
      leadData.loanProduct = loanProductId;
      const loan = await LoanProduct.findById(loanProductId).select('bank redirectUrl redirectActive').lean();
      if (loan?.bank) leadData.bank = loan.bank;
      if (loan?.redirectActive && loan?.redirectUrl) loanRedirectUrl = loan.redirectUrl;
    }

    if (loanRedirectUrl) {
      const confirmedConsent = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', label: 'Confirmed' }).select('_id').lean();
      if (confirmedConsent) leadData.consentStatus = confirmedConsent._id;
    } else {
      const sentConsent = await EmployeeStatus.findOne({ label: /^sent$/i, statusType: 'whatsapp_consent', isActive: true }).select('_id').lean();
      if (sentConsent) leadData.consentStatus = sentConsent._id;
    }

    const lead = await Lead.create(leadData);

    if (!loanRedirectUrl) {
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
    const loans = await LoanProduct.find({ isActive: true })
      .populate({ path: 'bank', select: 'name code logo isActive' })
      .select('name loanCategory commissionBrackets bank benefits feesEligibility interestRateRange minSalary maxLoanAmount maxTenure keyNotes rateMin rateMax rateType rateBasis salaryTransferRequired tags processingFee earlySettlement lateFee maxAmountNote maxAmountNum disclosedNote source sourceLabel tenureMaxMonths loanType redirectUrl redirectActive')
      .lean();
    res.json(loans.filter(l => l.bank?.isActive !== false));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
