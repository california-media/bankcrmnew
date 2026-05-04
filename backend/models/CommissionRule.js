const mongoose = require('mongoose');

/**
 * A flat per-approved-lead payout amount (in AED) for a (productType, bank?) pair.
 * If `bank` is null, the rule is the default for that product across all banks.
 * Resolution order in commission.service.js: (productType, bank) → (productType, null).
 */
const commissionRuleSchema = new mongoose.Schema(
  {
    productType: { type: String, enum: ['credit_card', 'loan'], required: true },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', default: null },
    amount: { type: Number, required: true, min: 0 },
    tier: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CommissionRule', commissionRuleSchema);
