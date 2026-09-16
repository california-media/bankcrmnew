const mongoose = require('mongoose');

// Admin Account Panel: "credit notes" — a manual balance adjustment admin can
// issue to an agency (e.g. a goodwill credit, a correction to a receivable/
// payable figure) that isn't tied to any single lead's own commission fields.
// Deliberately its own collection: nothing else reads from it, so it can't
// disturb Lead-based commission/payout logic already in place.
const creditNoteSchema = new mongoose.Schema(
  {
    agency: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }, // optional reference
    noteNumber: { type: String, trim: true, unique: true },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true, required: true },
    status: { type: String, enum: ['open', 'settled', 'cancelled'], default: 'open' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    settledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    settledAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CreditNote', creditNoteSchema);
