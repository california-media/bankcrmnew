const mongoose = require('mongoose');
const { DEFAULT_SEGMENTS } = require('../utils/coins');

// Singleton — super-admin controlled settings for the coins feature
// (daily spin wheel + invite reward).
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
