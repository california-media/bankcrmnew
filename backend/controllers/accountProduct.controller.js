const AccountProduct = require('../models/AccountProduct');
const User = require('../models/User');
const { resolveAgencyId } = require('../middleware/auth.middleware');

const POPULATE = [
  { path: 'bank', select: 'name code isActive logo' },
  { path: 'agency', select: 'name email' },
];

exports.list = async (req, res) => {
  try {
    const filter = {};
    // Product Admin's per-agency assignment — empty/absent assignedAgencies
    // stays visible to everyone (unchanged default); admin always sees all.
    if (req.user.role !== 'admin') {
      const agencyId = req.user.role === 'employee' ? resolveAgencyId(req.user) : (req.user.role === 'agency' ? req.user._id : req.user.agency);
      filter.$or = [
        { assignedAgencies: { $exists: false } },
        { assignedAgencies: { $size: 0 } },
        ...(agencyId ? [{ assignedAgencies: agencyId }] : []),
      ];
    }
    const accounts = await AccountProduct.find(filter).populate(POPULATE).sort({ name: 1 });
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const {
      name, accountCategory, bank, agency, assignedAgencies, commissionBrackets,
      isActive, agentVisible, sendConsent, websiteVisible,
      minBalance, monthlyFee, interestRate, rateMin, rateMax, keyNotes, tags,
      type, digitalOnboarding, multiCurrency, salaryTransferRequired, freeTransactions, fallBelowFee, payoutFrequency,
      benefits, feesEligibility, redirectUrl, redirectActive,
    } = req.body;
    if (!name || !accountCategory || !bank) {
      return res.status(400).json({ message: 'name, accountCategory, and bank are required' });
    }
    if (agency) {
      const agencyUser = await User.findOne({ _id: agency, role: 'agency' });
      if (!agencyUser) return res.status(400).json({ message: 'Invalid agency' });
    }
    const account = await AccountProduct.create({
      name, accountCategory, bank, agency: agency || undefined,
      assignedAgencies: assignedAgencies || [],
      commissionBrackets: commissionBrackets || [],
      benefits: benefits || '', feesEligibility: feesEligibility || '',
      isActive, agentVisible, sendConsent, websiteVisible,
      minBalance, monthlyFee, interestRate, rateMin, rateMax, keyNotes, tags: tags || [],
      type, digitalOnboarding, multiCurrency, salaryTransferRequired, freeTransactions, fallBelowFee, payoutFrequency,
      redirectUrl: redirectUrl || '', redirectActive: !!redirectActive,
    });
    const populated = await account.populate(POPULATE);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const {
      name, accountCategory, bank, agency, assignedAgencies, commissionBrackets,
      isActive, agentVisible, sendConsent, websiteVisible,
      minBalance, monthlyFee, interestRate, rateMin, rateMax, keyNotes, tags,
      type, digitalOnboarding, multiCurrency, salaryTransferRequired, freeTransactions, fallBelowFee, payoutFrequency,
      benefits, feesEligibility, redirectUrl, redirectActive,
    } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (accountCategory !== undefined) update.accountCategory = accountCategory;
    if (bank !== undefined) update.bank = bank;
    if (agency !== undefined) {
      const agencyUser = await User.findOne({ _id: agency, role: 'agency' });
      if (!agencyUser) return res.status(400).json({ message: 'Invalid agency' });
      update.agency = agency;
    }
    if (assignedAgencies !== undefined) update.assignedAgencies = assignedAgencies;
    if (commissionBrackets !== undefined) update.commissionBrackets = commissionBrackets;
    if (isActive !== undefined) update.isActive = isActive;
    if (agentVisible !== undefined) update.agentVisible = agentVisible;
    if (sendConsent !== undefined) update.sendConsent = sendConsent;
    if (websiteVisible !== undefined) update.websiteVisible = websiteVisible;
    if (minBalance !== undefined) update.minBalance = minBalance;
    if (monthlyFee !== undefined) update.monthlyFee = monthlyFee;
    if (interestRate !== undefined) update.interestRate = interestRate;
    if (rateMin !== undefined) update.rateMin = rateMin;
    if (rateMax !== undefined) update.rateMax = rateMax;
    if (type !== undefined) update.type = type;
    if (digitalOnboarding !== undefined) update.digitalOnboarding = digitalOnboarding;
    if (multiCurrency !== undefined) update.multiCurrency = multiCurrency;
    if (salaryTransferRequired !== undefined) update.salaryTransferRequired = salaryTransferRequired;
    if (freeTransactions !== undefined) update.freeTransactions = freeTransactions;
    if (fallBelowFee !== undefined) update.fallBelowFee = fallBelowFee;
    if (payoutFrequency !== undefined) update.payoutFrequency = payoutFrequency;
    if (keyNotes !== undefined) update.keyNotes = keyNotes;
    if (tags !== undefined) update.tags = tags;
    if (benefits !== undefined) update.benefits = benefits;
    if (feesEligibility !== undefined) update.feesEligibility = feesEligibility;
    if (redirectUrl !== undefined) update.redirectUrl = redirectUrl || '';
    if (redirectActive !== undefined) update.redirectActive = !!redirectActive;

    const account = await AccountProduct.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate(POPULATE);
    if (!account) return res.status(404).json({ message: 'Account product not found' });
    res.json(account);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const account = await AccountProduct.findByIdAndDelete(req.params.id);
    if (!account) return res.status(404).json({ message: 'Account product not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
