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
    loanCategory: { type: String, enum: ['personal', 'mortgage', 'investor', 'business', 'auto_loan', 'buyout', 'fresh', 'pdc', 'stl', 'pos_loan'], required: true },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Product Admin: "assign to agency products and banks". Empty/absent =
    // visible to every agency (today's default, unchanged) — only agencies
    // listed here can see the product once it's non-empty.
    assignedAgencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    commissionBrackets: { type: [bracketSchema], default: [] },
    benefits: { type: String, default: '' },
    feesEligibility: { type: String, default: '' },
    isActive:       { type: Boolean, default: true },
    agentVisible:   { type: Boolean, default: true },
    // Per-product WhatsApp consent toggle — client wants each product
    // individually switchable (e.g. a bank's cards on, its loans off).
    // Defaults true so nothing already relying on consent sending changes.
    sendConsent:    { type: Boolean, default: true },
    websiteVisible: { type: Boolean, default: true },
    redirectUrl:    { type: String, trim: true },
    redirectActive: { type: Boolean, default: false },
    interestRateRange: { type: String, trim: true },
    minSalary: { type: Number },
    maxLoanAmount: { type: String, trim: true },
    maxTenure: { type: String, trim: true },
    keyNotes: { type: String, trim: true },
    rateMin: { type: Number },
    rateMax: { type: Number },
    rateType: { type: String, trim: true },
    rateBasis: { type: String, enum: ['reducing', 'flat', 'fixed'], trim: true },
    salaryTransferRequired: { type: Boolean, default: null },
    tags: { type: [String], default: [] },
    processingFee: { type: String, trim: true },
    earlySettlement: { type: String, trim: true },
    lateFee: { type: String, trim: true },
    maxAmountNote: { type: String, trim: true },
    maxAmountNum: { type: Number },
    disclosedNote: { type: String, trim: true },
    source: { type: String, trim: true },
    sourceLabel: { type: String, trim: true },
    tenureMaxMonths: { type: Number },
    loanType: { type: String, enum: ['Islamic', 'Conventional'], trim: true },
    minTurnover: { type: Number },
    collateralRequired: { type: Boolean, default: false },
    minPosHistoryMonths: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LoanProduct', loanProductSchema);
