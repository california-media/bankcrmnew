const mongoose = require('mongoose');

const bracketSchema = new mongoose.Schema(
  {
    minimumSalary: { type: Number, required: true, min: 0 },
    receivable: { type: Number, required: true, min: 0 },
    payable: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const loanProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    loanCategory: { type: String, enum: ['personal', 'mortgage', 'investor', 'business', 'auto_loan', 'buyout', 'fresh', 'pdc', 'stl'], required: true },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    commissionBrackets: { type: [bracketSchema], default: [] },
    benefits: { type: String, default: '' },
    feesEligibility: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    interestRateRange: { type: String, trim: true },
    minSalary: { type: Number },
    maxLoanAmount: { type: String, trim: true },
    maxTenure: { type: String, trim: true },
    keyNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoanProduct', loanProductSchema);
