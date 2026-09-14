const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'lead_created', 'lead_assigned', 'status_changed', 'employee_status_updated', 'note_added', 'commission_payable', 'cpv_done', 'activate_done', 'agency_payout_submitted', 'commission_paid',
        // Milestone completions from lead.controller.js's makeMilestoneHandler factory
        'pos_loan_account_open_done', 'car_loan_registration_done',
        'mortgage_new_docs_done', 'mortgage_new_evaluation_done', 'mortgage_new_registration_done',
        'mortgage_buyout_docs_done', 'mortgage_buyout_evaluation_done', 'mortgage_buyout_ll_done', 'mortgage_buyout_mc_done', 'mortgage_buyout_cl_done', 'mortgage_buyout_registration_done',
        'business_account_open_done', 'business_account_fund_credited_done',
        'current_account_open_done', 'current_account_salary_credited_done',
        'savings_account_open_done', 'savings_fund_credited_done',
      ],
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
