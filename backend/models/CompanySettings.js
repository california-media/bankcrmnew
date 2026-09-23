const mongoose = require('mongoose');

// Singleton — always one document, admin-editable, read by every invoice
// render (view + PDF) so bank details / notes text can change without a
// code deploy and every invoice (past and future) picks up the new value.
const companySettingsSchema = new mongoose.Schema(
  {
    bank: {
      accountName: { type: String, trim: true, default: 'SILAH LLC FZ' },
      bankName: { type: String, trim: true, default: 'FIRST ABUDHABI BANK' },
      accountNo: { type: String, trim: true, default: '1001327172066000' },
      iban: { type: String, trim: true, default: 'AE400351001327172066' },
    },
    notesLines: {
      type: [String],
      default: [
        'Payment is due as per the agreed payment terms.',
        'Please include the invoice number in the payment reference.',
        'Late payment may be subject to applicable terms.',
        'For invoice queries, please contact us.',
      ],
    },
    vatNote: {
      type: String,
      trim: true,
      default: 'Since Silah is a newly established company, our VAT registration is currently under process.',
    },
    // Default VAT rate offered when creating a new invoice — each invoice
    // stores its own vatRate/vatApplicable snapshot, so changing this later
    // doesn't alter invoices already created.
    vatRate: { type: Number, min: 0, max: 100, default: 5 },
  },
  { timestamps: true }
);

companySettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

module.exports = mongoose.model('CompanySettings', companySettingsSchema);
