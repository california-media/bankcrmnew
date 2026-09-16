const mongoose = require('mongoose');

// One row per (agent, tier) — created once, lazily, the first time an
// agent's LIFETIME disbursed-card count crosses that tier's threshold.
// Rewards never reset on a calendar boundary; `month` just records which
// month the agent happened to cross it in, for reference/history only —
// it is not part of the earning identity. Never deleted retroactively even
// if the tier is edited afterward, so an agent keeps credit for what they
// actually earned.
const promotionAwardSchema = new mongoose.Schema(
  {
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    tier: { type: mongoose.Schema.Types.ObjectId, ref: 'PromotionTier', required: true },
    month: { type: String, required: true }, // 'YYYY-MM' the tier was actually crossed in — informational only
    cardCount: { type: Number, required: true }, // snapshot of the agent's lifetime count at award time
    status: { type: String, enum: ['earned', 'sent', 'redeemed'], default: 'earned' },
    fulfilledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fulfilledAt: { type: Date },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

promotionAwardSchema.index({ agent: 1, tier: 1 }, { unique: true });

module.exports = mongoose.model('PromotionAward', promotionAwardSchema);
