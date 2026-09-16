const mongoose = require('mongoose');

// Agent Panel "Promotion" tab reward tiers — e.g. 5 cards -> movie ticket
// voucher, 20 cards -> a trip. Admin-managed, any number of tiers.
//
// Each tier picks its own counting window:
//   - 'lifetime': every disbursed card the agent has ever had, no reset.
//   - 'months':   a calendar-aligned rolling window of `windowMonths` whole
//                 months ending with the current one — e.g. windowMonths=2
//                 in October counts September + October. The window shifts
//                 forward every month; it is NOT a fixed quarter.
const promotionTierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // internal label, e.g. "Tier 1"
    threshold: { type: Number, required: true, min: 1 }, // disbursed cards needed within the window
    rewardTitle: { type: String, required: true, trim: true }, // e.g. "Movie Ticket Voucher"
    rewardDescription: { type: String, trim: true }, // e.g. "2 tickets at VOX Cinemas"
    isActive: { type: Boolean, default: true },
    windowType: { type: String, enum: ['lifetime', 'months'], default: 'lifetime' },
    windowMonths: { type: Number, min: 1 }, // required when windowType === 'months'; ignored otherwise
    // Which disbursed product types count toward this tier. Defaults to
    // credit_card only, so tiers created before this field existed keep
    // behaving exactly as before (they were only ever about cards).
    productTypes: {
      type: [String],
      enum: ['credit_card', 'loan', 'account'],
      default: ['credit_card'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PromotionTier', promotionTierSchema);
