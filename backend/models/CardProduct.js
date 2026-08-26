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
    rewardBadges: {
      type: [{
        badgeOrder: { type: Number, default: 1 },
        icon: { type: String, default: '' },
        valueType: { type: String, enum: ['percent', 'text'], default: 'text' },
        percentValue: { type: Number, default: null },
        labelOrText: { type: String, default: '' },
        _id: false,
      }],
      default: [],
    },
    rate: { type: String, trim: true, default: '' },
    benefits: { type: String, default: '' },
    feesEligibility: { type: String, default: '' },
    keyFeatures: { type: String, default: '' },
    clawbackMonths: { type: Number, default: 0, min: 0 },
    clawbackDays:   { type: Number, default: 30, min: 0 },
    isActive:       { type: Boolean, default: true },
    agentVisible:   { type: Boolean, default: true },
    websiteVisible: { type: Boolean, default: true },
    cardImage:      { type: String, trim: true },
    redirectUrl:    { type: String, trim: true },
    redirectActive: { type: Boolean, default: false },
    kfsUrl:         { type: String, trim: true, default: '' },
    tncUrl:         { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CardProduct', cardProductSchema);
