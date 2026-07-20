const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['lead_created', 'lead_assigned', 'status_changed', 'employee_status_updated', 'note_added', 'commission_payable', 'cpv_done', 'activate_done', 'agency_payout_submitted', 'commission_paid'],
      required: true,
    },
    title:  { type: String, required: true },
    body:   { type: String, required: true },
    lead:   { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
