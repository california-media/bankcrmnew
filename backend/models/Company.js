const mongoose = require('mongoose');

// Predefined list of lead companies maintained by the super admin. Lead.companyName stays free text.
// One document per company + bank: the same company can be listed under several banks.
const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    nameKey: { type: String, required: true },
    // Free text, information only — shown to admin and agency (incl. staff), never to agents or the public form.
    bankName: { type: String, trim: true, maxlength: 80, default: '' },
    bankKey: { type: String, default: '' },
    category: { type: String, trim: true, maxlength: 60, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

companySchema.index({ nameKey: 1, bankKey: 1 }, { unique: true });

module.exports = mongoose.model('Company', companySchema);
