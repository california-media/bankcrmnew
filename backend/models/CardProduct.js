const mongoose = require('mongoose');

const bracketSchema = new mongoose.Schema(
  {
    minimumSalary: { type: Number, required: true, min: 0 },
    receivable: { type: Number, required: true, min: 0 },
    payable: { type: Number, required: true, min: 0 },
    agencyOverride: { type: Number, min: 0, default: 0 }, // extra AED paid to the agent's tagging agency on disbursal
    feeType: { type: String, enum: ['free', 'paid', 'free_tnc', 'first_year_free'], default: 'free' },
    annualFeeAmount: { type: Number, min: 0, default: null },
  },
  { _id: false }
);

const cardProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    cardType: { type: String, enum: ['regular', 'premium', 'rewards_lifestyle', 'cashback', 'islamic', 'travel', 'ecommerce', 'legacy'], required: true },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Product Admin: "assign to agency products and banks". Empty/absent =
    // visible to every agency (today's default, unchanged) — only agencies
    // listed here can see the product once it's non-empty.
    assignedAgencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    commissionBrackets: { type: [bracketSchema], default: [] },
    cashbackCategories: {
      type: [{
        category: { type: mongoose.Schema.Types.ObjectId, ref: 'CardCategory', required: true },
        rate: { type: Number, min: 0, max: 100, default: null },
        _id: false,
      }],
      default: [],
    },
    rewardBadges: {
      type: [{
        badgeOrder: { type: Number, default: 1 },
        icon: { type: String, default: '' },
        valueType: { type: String, enum: ['percent', 'text'], default: 'text' },
        percentValue: { type: Number, default: null },
        labelOrText: { type: String, default: '' },
        _id: false,
      }],
      default: [],
    },
    rate: { type: String, trim: true, default: '' },
    benefits: { type: String, default: '' },
    feesEligibility: { type: String, default: '' },
    keyFeatures: { type: String, default: '' },
    additionalBenefits: { type: String, default: '' },
    // Website ⓘ tooltips on the card's Annual Fee / Rate / Minimum Salary /
    // Salary Transfer. Empty = the site's default text.
    feeTooltip:      { type: String, trim: true, default: '' },
    rateTooltip:     { type: String, trim: true, default: '' },
    salaryTooltip:   { type: String, trim: true, default: '' },
    transferTooltip: { type: String, trim: true, default: '' },
    // Website "Salary Transfer" box. '' = not specified.
    salaryTransfer: { type: String, enum: ['', 'required', 'not_required'], default: '' },
    // Free-text bullet lines under the website's Fees Charges & Eligibility
    // boxes, e.g. 'Late payment fee: AED 230'.
    feeNotes: { type: [{ type: String, trim: true }], default: [] },
    clawbackMonths: { type: Number, default: 0, min: 0 },
    clawbackDays:   { type: Number, default: 30, min: 0 },
    isActive:       { type: Boolean, default: true },
    agentVisible:   { type: Boolean, default: true },
    // Per-product WhatsApp consent toggle — client wants each product
    // individually switchable (e.g. a bank's cards on, its loans off).
    // Defaults true so nothing already relying on consent sending changes.
    sendConsent:    { type: Boolean, default: true },
    websiteVisible: { type: Boolean, default: true },
    cardImage:      { type: String, trim: true },
    redirectUrl:    { type: String, trim: true },
    redirectActive: { type: Boolean, default: false },
    // Independent from redirectActive — controls whether this product is
    // offered as a pickable option on the public /ref/:code referral form,
    // not whether a submitted lead redirects to the bank.
    referralVisible: { type: Boolean, default: false },
    kfsUrl:         { type: String, trim: true, default: '' },
    tncUrl:         { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CardProduct', cardProductSchema);
