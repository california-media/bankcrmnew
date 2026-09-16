const mongoose = require('mongoose');

// A small trail of admin lead deletions. Deliberately separate from the
// Lead collection — deleting a Lead never touches this, and nothing else
// reads from it, so it can't disturb any existing feature.
const leadDeletionLogSchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, required: true },
    leadNumber: { type: String, trim: true },
    customerName: { type: String, trim: true },
    status: { type: String, trim: true },
    commissionStatus: { type: String, trim: true },
    agencyPaymentStatus: { type: String, trim: true },
    commission: { type: Number, default: 0 },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeadDeletionLog', leadDeletionLogSchema);
