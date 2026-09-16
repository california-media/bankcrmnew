const LoanProduct = require('../models/LoanProduct');
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
    const loans = await LoanProduct.find(filter).populate(POPULATE).sort({ name: 1 });
    res.json(loans);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, loanCategory, bank, agency, assignedAgencies, commissionBrackets, isActive, agentVisible, sendConsent, websiteVisible, interestRateRange, minSalary, maxLoanAmount, maxTenure, keyNotes, minTurnover, collateralRequired, minPosHistoryMonths } = req.body;
    if (!name || !loanCategory || !bank) {
      return res.status(400).json({ message: 'name, loanCategory, and bank are required' });
    }
    if (agency) {
      const agencyUser = await User.findOne({ _id: agency, role: 'agency' });
      if (!agencyUser) return res.status(400).json({ message: 'Invalid agency' });
    }

    const { benefits, feesEligibility, redirectUrl, redirectActive } = req.body;
    const loan = await LoanProduct.create({ name, loanCategory, bank, agency: agency || undefined, assignedAgencies: assignedAgencies || [], commissionBrackets: commissionBrackets || [], benefits: benefits || '', feesEligibility: feesEligibility || '', isActive, agentVisible, sendConsent, websiteVisible, interestRateRange, minSalary, maxLoanAmount, maxTenure, keyNotes, minTurnover, collateralRequired, minPosHistoryMonths, redirectUrl: redirectUrl || '', redirectActive: !!redirectActive });
    const populated = await loan.populate(POPULATE);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, loanCategory, bank, agency, assignedAgencies, commissionBrackets, isActive, agentVisible, sendConsent, websiteVisible } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (loanCategory !== undefined) update.loanCategory = loanCategory;
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
    const { interestRateRange, minSalary, maxLoanAmount, maxTenure, keyNotes, minTurnover, collateralRequired, minPosHistoryMonths } = req.body;
    if (interestRateRange !== undefined) update.interestRateRange = interestRateRange;
    if (minSalary !== undefined) update.minSalary = minSalary;
    if (maxLoanAmount !== undefined) update.maxLoanAmount = maxLoanAmount;
    if (maxTenure !== undefined) update.maxTenure = maxTenure;
    if (keyNotes !== undefined) update.keyNotes = keyNotes;
    if (minTurnover !== undefined) update.minTurnover = minTurnover;
    if (collateralRequired !== undefined) update.collateralRequired = collateralRequired;
    if (minPosHistoryMonths !== undefined) update.minPosHistoryMonths = minPosHistoryMonths;
    const { benefits, feesEligibility } = req.body;
    if (benefits !== undefined) update.benefits = benefits;
    if (feesEligibility !== undefined) update.feesEligibility = feesEligibility;
    const { redirectUrl, redirectActive } = req.body;
    if (redirectUrl !== undefined) update.redirectUrl = redirectUrl || '';
    if (redirectActive !== undefined) update.redirectActive = !!redirectActive;

    const loan = await LoanProduct.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate(POPULATE);
    if (!loan) return res.status(404).json({ message: 'Loan product not found' });
    res.json(loan);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const loan = await LoanProduct.findByIdAndDelete(req.params.id);
    if (!loan) return res.status(404).json({ message: 'Loan product not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
