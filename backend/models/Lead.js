const mongoose = require('mongoose');

const LEAD_STATUSES = [
  'submitted',
  'assigned_to_bank',
  'under_review',
  'approved',
  'rejected',
  'disbursed',
];

const leadSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    productType: { type: String, enum: ['credit_card', 'loan'], required: true },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
    status: { type: String, enum: LEAD_STATUSES, default: 'submitted' },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    commission: { type: Number, default: 0 },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

leadSchema.statics.STATUSES = LEAD_STATUSES;

module.exports = mongoose.model('Lead', leadSchema);
