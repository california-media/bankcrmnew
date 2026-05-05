const mongoose = require('mongoose');

/**
 * Per-agency commission rule: how many AED the agency pays an agent for an
 * approved lead of `productType` against `bank`. `bank: null` is the agency's
 * default for that product.
 */
const commissionRuleSchema = new mongoose.Schema(
  {
    productType: { type: String, enum: ['credit_card', 'loan'], required: true },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', default: null },
    amount: { type: Number, required: true, min: 0 },
    tier: { type: String, trim: true },
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CommissionRule', commissionRuleSchema);
