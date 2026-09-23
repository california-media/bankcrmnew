const mongoose = require('mongoose');

// Admin Account Panel: invoice raised against an agency — either auto-suggested
// from a disbursed lead's commission, or created manually by admin. Kept as
// its own collection, separate from Lead/CreditNote — nothing else reads it.
const lineItemSchema = new mongoose.Schema(
  {
    customerName: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, required: true },
    qty: { type: Number, required: true, min: 1, default: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    vatAmount: { type: Number, min: 0, default: 0 },
    amount: { type: Number, required: true, min: 0 }, // = qty*unitPrice + vatAmount, computed server-side
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }, // optional — set when raised from a single disbursed lead
    leads: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }], default: undefined }, // set instead of `lead` when raised from multiple disbursed leads in one invoice
    invoiceNumber: { type: String, trim: true, unique: true, required: true },
    lineItems: { type: [lineItemSchema], required: true, validate: (v) => Array.isArray(v) && v.length > 0 },
    amount: { type: Number, required: true, min: 0 }, // sum of lineItems, denormalized for quick listing/sorting
    notes: { type: String, trim: true },
    status: { type: String, enum: ['unpaid', 'paid', 'cancelled'], default: 'unpaid' },
    issuedAt: { type: Date, default: Date.now },
    paidAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dueDays: { type: Number, min: 0, default: 15 },
    paymentTermsDays: { type: Number, min: 0, default: 30 },
    // Whether VAT is charged on this invoice at all, and at what rate —
    // both admin-controlled per invoice (defaults come from CompanySettings
    // at creation time). Each line's vatAmount is derived from these, not
    // typed in by hand.
    vatApplicable: { type: Boolean, default: false },
    vatRate: { type: Number, min: 0, max: 100, default: 5 },
    // Agency's own billing details for the "Bill To" box — the agency profile
    // itself doesn't carry these, so admin fills them in per invoice.
    billTo: {
      trn: { type: String, trim: true, default: '' },
      address: { type: String, trim: true, default: '' },
      contact: { type: String, trim: true, default: '' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
