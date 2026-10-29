const mongoose = require('mongoose');
const { DEFAULT_SEGMENTS, DEFAULT_TIERS, DEFAULT_STREAK_BONUSES, defaultMissions } = require('../utils/coins');

// Singleton — super-admin controlled settings for the coins feature
// (daily spin wheel, invite reward, levels, streak bonuses, promo strip, challenges).
const coinSettingsSchema = new mongoose.Schema(
  {
    spinEnabled: { type: Boolean, default: false },
    spinSegments: {
      type: [
        new mongoose.Schema(
          { coins: { type: Number, required: true }, weight: { type: Number, required: true } },
          { _id: false }
        ),
      ],
      default: () => DEFAULT_SEGMENTS.map((s) => ({ coins: s.coins, weight: s.weight })),
    },
    inviteEnabled: { type: Boolean, default: false },
    inviteReward: { type: Number, default: 1000 },
    // Levels by lifetime coins earned: ascending, first at 0.
    tiers: {
      type: [
        new mongoose.Schema(
          { name: { type: String, required: true, trim: true }, minCoins: { type: Number, required: true } },
          { _id: false }
        ),
      ],
      default: () => DEFAULT_TIERS.map((t) => ({ ...t })),
    },
    // Paid once when the daily-spin streak reaches exactly `days`.
    streakBonuses: {
      type: [
        new mongoose.Schema(
          { days: { type: Number, required: true }, coins: { type: Number, required: true } },
          { _id: false }
        ),
      ],
      default: () => DEFAULT_STREAK_BONUSES.map((b) => ({ ...b })),
    },
    promoText: { type: String, trim: true, default: '' },
    // Admin overrides for the fixed challenge catalogue (utils/coins MISSION_DEFS).
    missions: {
      type: [
        new mongoose.Schema(
          {
            key: { type: String, required: true },
            enabled: { type: Boolean, default: true },
            target: { type: Number, required: true },
            coins: { type: Number, required: true },
          },
          { _id: false }
        ),
      ],
      default: defaultMissions,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

coinSettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) doc = new this({});
  if (doc.isNew || doc.isModified()) await doc.save();
  return doc;
};

module.exports = mongoose.model('CoinSettings', coinSettingsSchema);
