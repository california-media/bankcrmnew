const mongoose = require('mongoose');

/**
 * Monthly volume bonus tier: if an agent has >= `threshold` approved leads
 * in a calendar month, they earn `amount` (AED) on top of per-lead commissions.
 * The highest threshold met wins (no stacking).
 */
const volumeBonusSchema = new mongoose.Schema(
  {
    threshold: { type: Number, required: true, min: 1 },
    amount: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('VolumeBonus', volumeBonusSchema);
