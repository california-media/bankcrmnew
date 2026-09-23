const mongoose = require('mongoose');

// Admin-curated training material for the Agent Panel "Partner Guide" tab —
// e.g. a "How to submit a lead" video + its written guidelines doc. Any
// number of resources, admin-managed, shown to agents as a read-only list.
const partnerResourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true }, // e.g. "Getting Started"
    description: { type: String, trim: true },
    videoLink: { type: String, trim: true }, // external URL, e.g. YouTube/Vimeo
    docsLink: { type: String, trim: true }, // external URL, e.g. Google Drive
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PartnerResource', partnerResourceSchema);
