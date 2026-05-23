const mongoose = require('mongoose');

const bucketRequestSchema = new mongoose.Schema(
  {
    agency:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount:          { type: Number, required: true },
    note:            { type: String, trim: true },
    receiptFile:     { type: String, trim: true },
    status:          { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt:      { type: Date },
    rejectionReason: { type: String, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BucketRequest', bucketRequestSchema);
