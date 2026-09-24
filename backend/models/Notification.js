const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'lead_created', 'lead_assigned', 'status_changed', 'employee_status_updated', 'note_added', 'commission_payable', 'cpv_done', 'activate_done', 'agency_payout_submitted', 'commission_paid', 'product_changed',
        // Milestone completions from lead.controller.js's makeMilestoneHandler factory
        'pos_loan_account_open_done', 'car_loan_registration_done',
        'mortgage_new_docs_done', 'mortgage_new_evaluation_done', 'mortgage_new_registration_done',
        'mortgage_buyout_docs_done', 'mortgage_buyout_evaluation_done', 'mortgage_buyout_ll_done', 'mortgage_buyout_mc_done', 'mortgage_buyout_cl_done', 'mortgage_buyout_registration_done',
        'business_account_open_done', 'business_account_fund_credited_done',
        'current_account_open_done', 'current_account_salary_credited_done',
        'savings_account_open_done', 'savings_fund_credited_done',
        // Card / loan milestones with their own handlers in lead.controller.js
        'spend_done', 'pdc_chq_done', 'pos_dda_done', 'pos_pdc_done',
        'fresh_account_open_done', 'fresh_stl_done',
        'buyout_account_open_done', 'buyout_ll_received_done', 'buyout_mc_submitted_done', 'buyout_cl_received_done', 'buyout_stl_done',
        'sme_account_open_done', 'sme_buyout_account_open_done', 'sme_buyout_ll_done', 'sme_buyout_mc_done', 'sme_buyout_cl_done',
        'hold_released',
        // Agency wallet top-up requests (agencyPayout.controller.js)
        'bucket_request',
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
