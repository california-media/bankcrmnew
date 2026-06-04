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
    leadNumber: { type: String, unique: true, sparse: true },
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    isReferral: { type: Boolean, default: false },
    productType: { type: String, enum: ['credit_card', 'loan'] },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank' },
    // Card or loan product selected at lead creation
    cardProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'CardProduct' },
    loanProduct: { type: mongoose.Schema.Types.ObjectId, ref: 'LoanProduct' },
    loanAmount: { type: Number, min: 0 },
    loanType: { type: String, enum: ['buyout', 'pdc', 'new_stl_loan', null], default: null },
    customerSalary: { type: Number, min: 0 },
    email: { type: String, trim: true },
    visaType: { type: String, trim: true },
    nationality: { type: String, trim: true },
    companyName: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    yearsOfExperience: { type: Number, min: 0 },
    status: { type: String, enum: LEAD_STATUSES, default: 'draft' },
    agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // grossCommission = raw commission from card/loan product (admin keeps this)
    grossCommission: { type: Number, default: 0 },
    // commission = agent's portion (set by admin, shown in agent ledger)
    commission: { type: Number, default: 0 },
    commissionStatus: { type: String, enum: COMMISSION_STATUSES, default: 'none' },
    commissionPaidAt: { type: Date },
    // Hold amount (credit card only) — portion of commission withheld until clawback period expires
    holdAmount: { type: Number, default: 0 },
    holdReleased: { type: Boolean, default: false },
    holdReleasedAt: { type: Date },
    clawbackUntil: { type: Date },
    // Admin-set agent commission split
    agentCommissionType: { type: String, enum: ['percentage', 'fixed'], default: 'fixed' },
    agentCommissionValue: { type: Number, default: 0 },
    assignedEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedCpvEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedSalesEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    engagementStatus: { type: String, enum: ENGAGEMENT_STATUSES, default: 'new_lead' },
    employeeStatus: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeStatus' },
    consentStatus:  { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeStatus' },
    loanStatus:     { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeStatus' },
    notes: { type: String, trim: true },
    cpvDone: { type: Boolean, default: false },
    cpvNote: { type: String, trim: true },
    activateDone: { type: Boolean, default: false },
    activateNote: { type: String, trim: true },
    agencyPaymentStatus: { type: String, enum: ['pending', 'agency_paid', 'received'], default: 'pending' },
    agencyPaymentReceivedAt: { type: Date },
    agencyPaymentNote: { type: String, trim: true },
    disbursementReceipt: { type: String, trim: true },
    disbursementReceiptFile: { type: String, trim: true },
    disbursementReceiptAt: { type: Date },
    statusHistory: [
      {
        status: { type: String },
        note: { type: String, trim: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    consentStatusHistory: [
      {
        consentStatus: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeStatus' },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    payoutHistory: [
      {
        amount: { type: Number, required: true },
        sentAt: { type: Date, default: Date.now },
        sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        month: { type: String },
        note: { type: String, trim: true },
        _id: false,
      },
    ],
    leadNotes: [
      {
        text: { type: String, required: true, trim: true },
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        authorRole: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

leadSchema.statics.STATUSES = LEAD_STATUSES;
leadSchema.statics.COMMISSION_STATUSES = COMMISSION_STATUSES;
leadSchema.statics.ENGAGEMENT_STATUSES = ENGAGEMENT_STATUSES;

module.exports = mongoose.model('Lead', leadSchema);
