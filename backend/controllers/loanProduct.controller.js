const LoanProduct = require('../models/LoanProduct');
const User = require('../models/User');

const POPULATE = [
  { path: 'bank', select: 'name code isActive logo' },
  { path: 'agency', select: 'name email' },
];

exports.list = async (req, res) => {
  try {
    const loans = await LoanProduct.find().populate(POPULATE).sort({ name: 1 });
    res.json(loans);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, loanCategory, bank, agency, commissionBrackets, isActive, interestRateRange, minSalary, maxLoanAmount, maxTenure, keyNotes } = req.body;
    if (!name || !loanCategory || !bank) {
      return res.status(400).json({ message: 'name, loanCategory, and bank are required' });
    }
    if (agency) {
      const agencyUser = await User.findOne({ _id: agency, role: 'agency' });
      if (!agencyUser) return res.status(400).json({ message: 'Invalid agency' });
    }

    const { benefits, feesEligibility } = req.body;
    const loan = await LoanProduct.create({ name, loanCategory, bank, agency: agency || undefined, commissionBrackets: commissionBrackets || [], benefits: benefits || '', feesEligibility: feesEligibility || '', isActive, interestRateRange, minSalary, maxLoanAmount, maxTenure, keyNotes });
    const populated = await loan.populate(POPULATE);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, loanCategory, bank, agency, commissionBrackets, isActive } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (loanCategory !== undefined) update.loanCategory = loanCategory;
    if (bank !== undefined) update.bank = bank;
    if (agency !== undefined) {
      const agencyUser = await User.findOne({ _id: agency, role: 'agency' });
      if (!agencyUser) return res.status(400).json({ message: 'Invalid agency' });
      update.agency = agency;
    }
    if (commissionBrackets !== undefined) update.commissionBrackets = commissionBrackets;
    if (isActive !== undefined) update.isActive = isActive;
    const { interestRateRange, minSalary, maxLoanAmount, maxTenure, keyNotes } = req.body;
    if (interestRateRange !== undefined) update.interestRateRange = interestRateRange;
    if (minSalary !== undefined) update.minSalary = minSalary;
    if (maxLoanAmount !== undefined) update.maxLoanAmount = maxLoanAmount;
    if (maxTenure !== undefined) update.maxTenure = maxTenure;
    if (keyNotes !== undefined) update.keyNotes = keyNotes;
    const { benefits, feesEligibility } = req.body;
    if (benefits !== undefined) update.benefits = benefits;
    if (feesEligibility !== undefined) update.feesEligibility = feesEligibility;

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
