const mongoose = require('mongoose');

// Admin Account Panel: invoice raised against an agency — either auto-suggested
// from a disbursed lead's commission, or created manually by admin. Kept as
// its own collection, separate from Lead/CreditNote — nothing else reads it.
const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, trim: true, required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }, // optional — set when raised from a disbursed lead
    invoiceNumber: { type: String, trim: true, unique: true, required: true },
    lineItems: { type: [lineItemSchema], required: true, validate: (v) => Array.isArray(v) && v.length > 0 },
    amount: { type: Number, required: true, min: 0 }, // sum of lineItems, denormalized for quick listing/sorting
    notes: { type: String, trim: true },
    status: { type: String, enum: ['unpaid', 'paid', 'cancelled'], default: 'unpaid' },
    issuedAt: { type: Date, default: Date.now },
    paidAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
