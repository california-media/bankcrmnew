/**
 * Import loan products from inzigo-site/mysilah-loans-content.xlsx
 * Run: node scripts/import_loans_excel.js
 */
require('dotenv').config();
const mongoose  = require('mongoose');
const XLSX      = require('xlsx');
const path      = require('path');

const Bank        = require('../models/Bank');
const LoanProduct = require('../models/LoanProduct');

const XLSX_PATH = path.join(__dirname, '../../inzigo-site/mysilah-loans-content.xlsx');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const wb        = XLSX.readFile(XLSX_PATH);
  const bankRows  = XLSX.utils.sheet_to_json(wb.Sheets['Banks'],  { defval: null });
  const loanRows  = XLSX.utils.sheet_to_json(wb.Sheets['Loans'],  { defval: null });

  // ── 1. Upsert banks ─────────────────────────────────────────────────────────
  const bankIdMap = {}; // excel bank_id → mongo _id
  for (const row of bankRows) {
    let bank = await Bank.findOne({ name: row.name });
    if (!bank) {
      bank = await Bank.create({
        name:     row.name,
        code:     row.short,
        isActive: true,
      });
      console.log(`  [Bank] Created: ${bank.name}`);
    } else {
      // update code if missing
      if (!bank.code && row.short) { bank.code = row.short; await bank.save(); }
      console.log(`  [Bank] Exists:  ${bank.name}`);
    }
    bankIdMap[row.id] = bank._id;
  }

  // ── 2. Upsert loan products ──────────────────────────────────────────────────
  let created = 0, updated = 0, skipped = 0;
  for (const row of loanRows) {
    const bankObjId = bankIdMap[row.bank_id];
    if (!bankObjId) {
      console.warn(`  [Loan] No bank found for bank_id "${row.bank_id}", skipping "${row.product}"`);
      skipped++;
      continue;
    }

    const salaryTransferRequired =
      row.salary_transfer_required === 'TRUE'  || row.salary_transfer_required === true  ? true  :
      row.salary_transfer_required === 'FALSE' || row.salary_transfer_required === false ? false : null;

    const tagsArray = row.tags
      ? row.tags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    const fields = {
      bank:                  bankObjId,
      name:                  row.product,
      loanCategory:          'personal',
      loanType:              row.type || 'Conventional',
      rateType:              row.rate_type  || '',
      rateMin:               row.rate_min   != null ? Number(row.rate_min)   : undefined,
      rateMax:               row.rate_max   != null ? Number(row.rate_max)   : undefined,
      rateBasis:             row.rate_basis || 'reducing',
      interestRateRange:     row.rate_display || '',
      minSalary:             row.min_salary  != null ? Number(row.min_salary)  : undefined,
      maxAmountNum:          row.max_amount  != null ? Number(row.max_amount)  : undefined,
      maxAmountNote:         row.max_amount_note || '',
      tenureMaxMonths:       row.tenure_max  != null ? Number(row.tenure_max)  : undefined,
      processingFee:         row.processing_fee   || '',
      earlySettlement:       row.early_settlement || '',
      lateFee:               row.late_fee          || '',
      salaryTransferRequired,
      tags:                  tagsArray,
      benefits:              row.features    || '',
      feesEligibility:       row.eligibility || '',
      source:                row.source       || '',
      sourceLabel:           row.source_label || '',
      isActive:              true,
    };

    // Match on bank + name
    const existing = await LoanProduct.findOne({ bank: bankObjId, name: row.product });
    if (existing) {
      await LoanProduct.updateOne({ _id: existing._id }, { $set: fields });
      console.log(`  [Loan] Updated: ${row.bank} — ${row.product}`);
      updated++;
    } else {
      await LoanProduct.create(fields);
      console.log(`  [Loan] Created: ${row.bank} — ${row.product}`);
      created++;
    }
  }

  console.log(`\nDone. Banks: ${bankRows.length}  Loans created: ${created}  updated: ${updated}  skipped: ${skipped}`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
