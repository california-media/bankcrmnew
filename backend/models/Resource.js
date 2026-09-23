const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', default: null },
    type: { type: String, enum: ['flyer', 'policy', 'training', 'other'], required: true },
    // A resource needs a file, a video link, or both — enforced in the
    // controller (create/update), not here, since either one alone is valid.
    file: { type: String, default: '' },
    fileType: { type: String, enum: ['image', 'pdf', ''], default: '' },
    videoLink: { type: String, trim: true, default: '' }, // external URL, e.g. YouTube/Vimeo
    // Same convention as CardProduct.assignedAgencies / Bank.assignedAgencies
    // (backend/models/CardProduct.js:23, backend/models/Bank.js:14): empty
    // or absent = visible to every agency; non-empty = only these.
    assignedAgencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Which portal audiences see this resource — 'agent'/'agency' match
    // User.role directly, the rest match User.employeeType. Empty/absent =
    // visible to every audience (same convention as assignedAgencies above).
    visibleToRoles: { type: [String], enum: ['agent', 'agency', 'coordinator', 'sales', 'cpv', 'account'], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resource', resourceSchema);
