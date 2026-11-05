const mongoose = require('mongoose');

// Shared emoji list for card Reward Badges. Cards store the emoji itself in
// rewardBadges[].icon; editing/deleting an emoji here rewrites those cards.
const badgeIconSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true, trim: true, unique: true },
    name:  { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BadgeIcon', badgeIconSchema);
