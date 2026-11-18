const mongoose = require('mongoose');

/**
 * Sara's guide videos for the mobile app ("Watch how it works" on the sign-in screen and in Learn).
 * Managed in admin Promotions > Sara Guide, separate from the Partner Guide (PartnerResource).
 * videoLink must be a YouTube link: the app plays YouTube only.
 */
const saraVideoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    videoLink: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SaraVideo', saraVideoSchema);
