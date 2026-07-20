const mongoose = require('mongoose');

const bracketSchema = new mongoose.Schema(
  {
    minimumSalary: { type: Number, required: true, min: 0 },
    receivable: { type: Number, required: true, min: 0 },
    payable: { type: Number, required: true, min: 0 },
    feeType: { type: String, enum: ['free', 'paid', 'free_tnc'], default: 'free' },
  },
  { _id: false }
);

const cardProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    cardType: { type: String, enum: ['regular', 'premium', 'rewards_lifestyle', 'travel', 'ecommerce', 'legacy'], required: true },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    commissionBrackets: { type: [bracketSchema], default: [] },
    cashbackCategories: {
      type: [{
        category: { type: mongoose.Schema.Types.ObjectId, ref: 'CardCategory', required: true },
        rate: { type: Number, min: 0, max: 100, default: null },
        _id: false,
      }],
      default: [],
    },
    benefits: { type: String, default: '' },
    feesEligibility: { type: String, default: '' },
    keyFeatures: { type: String, default: '' },
    clawbackMonths: { type: Number, default: 0, min: 0 },
    clawbackDays:   { type: Number, default: 30, min: 0 },
    isActive:       { type: Boolean, default: true },
    cardImage:      { type: String, trim: true },
    redirectUrl:    { type: String, trim: true },
    redirectActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CardProduct', cardProductSchema);
