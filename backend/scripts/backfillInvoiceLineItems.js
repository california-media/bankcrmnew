/**
 * One-shot: invoices created before the Qty/Unit Price/VAT/Customer Name
 * columns were added only stored { description, amount } per line item, so
 * they render with a blank/zero Unit Price and no Customer Name today.
 * Backfills, per line item missing unitPrice:
 *   - qty = 1, unitPrice = amount, vatAmount = 0 (matches the old
 *     single-figure-per-line behavior exactly: amount = qty*unitPrice+vat)
 *   - customerName, if blank and description ends in "(NAME)" (the old
 *     auto-fill format), is pulled out of that suffix and the suffix is
 *     trimmed off the description.
 * Also backfills invoice-level vatApplicable/vatRate if unset.
 * Run: node backend/scripts/backfillInvoiceLineItems.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');

const NAME_SUFFIX_RE = /^(.*)\s\(([^()]+)\)\s*$/;

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const invoices = await Invoice.find({ 'lineItems.unitPrice': { $exists: false } });
  console.log(`Found ${invoices.length} invoice(s) with old-shape line items.`);

  let changedCount = 0;
  for (const invoice of invoices) {
    let changed = false;
    invoice.lineItems.forEach((li) => {
      if (li.unitPrice == null) {
        li.qty = li.qty ?? 1;
        li.unitPrice = Number(li.amount) || 0;
        li.vatAmount = li.vatAmount ?? 0;
        changed = true;
      }
      if (!li.customerName) {
        const match = NAME_SUFFIX_RE.exec(li.description || '');
        if (match) {
          li.description = match[1].trim();
          li.customerName = match[2].trim();
          changed = true;
        }
      }
    });
    if (invoice.vatApplicable == null) { invoice.vatApplicable = false; changed = true; }
    if (invoice.vatRate == null) { invoice.vatRate = 5; changed = true; }
    if (changed) {
      await invoice.save();
      changedCount += 1;
    }
  }
  console.log(`Updated ${changedCount} invoice(s).`);
  await mongoose.disconnect();
})();
