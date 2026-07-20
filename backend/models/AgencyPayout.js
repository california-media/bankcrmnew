const mongoose = require('mongoose');

const agencyPayoutSchema = new mongoose.Schema(
  {
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    leads: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }],
    totalSelected: { type: Number, required: true },
    amountPaid: { type: Number, required: true },
    bucketUsed: { type: Number, default: 0 },
    bucketAdded: { type: Number, default: 0 },
    receiptNote: { type: String, trim: true },
    receiptFile: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AgencyPayout', agencyPayoutSchema);
