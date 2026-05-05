const mongoose = require('mongoose');

const LEAD_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'assigned',
  'approved',
  'rejected',
  'disbursed',
];

const COMMISSION_STATUSES = ['none', 'pending', 'payable', 'paid'];

// Agent-managed conversation/engagement state with the customer. Independent of
// the agency-side lifecycle in `status`. Default `new_lead` when the lead is
// first created.
const ENGAGEMENT_STATUSES = [
  'new_lead',
  'no_answer',
  'follow_up',
  'focused_follow_up',
  'meeting_scheduled',
  'not_interested',
  'junk',
  'pool',
  'closed_deal',
];

const leadSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    productType: { type: String, enum: ['credit_card', 'loan'], required: true },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
    status: { type: String, enum: LEAD_STATUSES, default: 'draft' },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    commission: { type: Number, default: 0 },
    commissionStatus: { type: String, enum: COMMISSION_STATUSES, default: 'none' },
    commissionPaidAt: { type: Date },
    engagementStatus: { type: String, enum: ENGAGEMENT_STATUSES, default: 'new_lead' },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

leadSchema.statics.STATUSES = LEAD_STATUSES;
leadSchema.statics.COMMISSION_STATUSES = COMMISSION_STATUSES;
leadSchema.statics.ENGAGEMENT_STATUSES = ENGAGEMENT_STATUSES;

module.exports = mongoose.model('Lead', leadSchema);
