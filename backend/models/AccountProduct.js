const mongoose = require('mongoose');

const bracketSchema = new mongoose.Schema(
  {
    minimumSalary: { type: Number, required: true, min: 0 },
    receivable: { type: Number, required: true, min: 0 },
    payable: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const accountProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    accountCategory: { type: String, enum: ['business', 'current', 'savings'], required: true },
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
    minBalance: { type: Number },
    monthlyFee: { type: String, trim: true },
    interestRate: { type: String, trim: true },
    rateMin: { type: Number },
    rateMax: { type: Number },
    type: { type: String, enum: ['Islamic', 'Conventional'], trim: true },
    digitalOnboarding: { type: Boolean, default: false },
    multiCurrency: { type: Boolean, default: false },
    salaryTransferRequired: { type: Boolean, default: null },
    freeTransactions: { type: String, trim: true },
    fallBelowFee: { type: String, trim: true },
    payoutFrequency: { type: String, trim: true },
    keyNotes: { type: String, trim: true },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AccountProduct', accountProductSchema);
