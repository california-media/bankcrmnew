'use strict';

/**
 * import_loans.js
 *
 * Imports personal loan products from the hardcoded BANKS + LOANS arrays
 * embedded in the mysilah-personal-loans.html file into MongoDB.
 *
 * Usage (from backend/ directory):
 *   node import_loans.js
 *
 * Environment / config:
 *   - MONGO_URI env var overrides the hardcoded URI below.
 *   - AGENCY_EMAIL env var overrides the hardcoded agency email below.
 */

const fs   = require('fs');
const path = require('path');

const mongoose    = require('mongoose');
const Bank        = require('./models/Bank');
const LoanProduct = require('./models/LoanProduct');
const User        = require('./models/User');

// ─── Config ──────────────────────────────────────────────────────────────────

const MONGO_URI   = process.env.MONGO_URI;
const AGENCY_EMAIL = process.env.AGENCY_EMAIL || 'mysilah@gmail.com';
const HTML_FILE   = path.resolve(
  __dirname,
  '../inzigo-site/mysilah-personal-loans.html'
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a <ul><li>…</li></ul> string from a features array.
 * Returns '' if the array is empty or falsy.
 */
function featuresToHtml(features) {
  if (!Array.isArray(features) || features.length === 0) return '';
  const items = features.map(f => `<li>${f}</li>`).join('');
  return `<ul>${items}</ul>`;
}

/**
 * Wrap eligibility text in a <p> tag.
 * Returns '' if falsy.
 */
function eligibilityToHtml(eligibility) {
  if (!eligibility) return '';
  return `<p>${eligibility}</p>`;
}

/**
 * Extract the raw JS source for the BANKS and LOANS const declarations
 * from the HTML file, then evaluate them in a sandboxed Function.
 *
 * Strategy:
 *   1. Locate the line that starts with "const BANKS = ["
 *   2. Collect lines until we hit the "];" that closes LOANS
 *   3. Rewrite "const" → "var" so the variables are function-scoped and
 *      accessible via the returned object.
 *   4. Wrap in a new Function and call it — no Node globals are exposed.
 *
 * Note: vm.runInNewContext with `const` does NOT expose block-scoped
 * variables on the sandbox object; the Function constructor approach is
 * the correct workaround.
 */
function extractArraysFromHtml(htmlPath) {
  const raw = fs.readFileSync(htmlPath, 'utf8');
  const lines = raw.split('\n');

  // Find the start of "const BANKS = ["
  let banksStartIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*const BANKS\s*=\s*\[/.test(lines[i])) {
      banksStartIdx = i;
      break;
    }
  }
  if (banksStartIdx === -1) {
    throw new Error('Could not find "const BANKS = [" in the HTML file.');
  }

  // Find "const LOANS = [" (must come after BANKS)
  let loansStartIdx = -1;
  for (let i = banksStartIdx + 1; i < lines.length; i++) {
    if (/^\s*const LOANS\s*=\s*\[/.test(lines[i])) {
      loansStartIdx = i;
      break;
    }
  }
  if (loansStartIdx === -1) {
    throw new Error('Could not find "const LOANS = [" in the HTML file.');
  }

  // Find the closing "];" of the LOANS array (first "];" after loansStartIdx)
  let loansEndIdx = -1;
  for (let i = loansStartIdx + 1; i < lines.length; i++) {
    if (/^\s*\];\s*$/.test(lines[i])) {
      loansEndIdx = i;
      break;
    }
  }
  if (loansEndIdx === -1) {
    throw new Error('Could not find the closing "];" of the LOANS array.');
  }

  // Slice out exactly the JS we need (both declarations)
  const rawSource = lines.slice(banksStartIdx, loansEndIdx + 1).join('\n');

  // Rewrite "const" to "var" so variables are function-scoped and returnable
  const jsSource = rawSource.replace(/\bconst\s+/g, 'var ');

  // Wrap in an IIFE via the Function constructor — no Node globals exposed
  let result;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`${jsSource}\nreturn { BANKS: BANKS, LOANS: LOANS };`);
    result = fn();
  } catch (err) {
    throw new Error(`Failed to evaluate BANKS/LOANS source: ${err.message}`);
  }

  if (!Array.isArray(result.BANKS)) {
    throw new Error('BANKS is not an array after evaluation.');
  }
  if (!Array.isArray(result.LOANS)) {
    throw new Error('LOANS is not an array after evaluation.');
  }

  return { BANKS: result.BANKS, LOANS: result.LOANS };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Parse the HTML file
  console.log(`Reading HTML file: ${HTML_FILE}`);
  const { BANKS, LOANS } = extractArraysFromHtml(HTML_FILE);
  console.log(`  Parsed ${BANKS.length} banks, ${LOANS.length} loans.`);

  // 2. Connect to MongoDB
  console.log('\nConnecting to MongoDB…');
  await mongoose.connect(MONGO_URI);
  console.log('  Connected.');

  try {
    // 3. Find the agency user
    const agency = await User.findOne({ email: AGENCY_EMAIL.toLowerCase(), role: 'agency' }).lean();
    if (!agency) {
      throw new Error(`Agency user not found for email "${AGENCY_EMAIL}" with role "agency".`);
    }
    console.log(`\nAgency: ${agency.name || agency.email} (${agency._id})`);

    // 4. Build a map of bankId → bank info from the BANKS array
    const bankInfoMap = {};
    for (const b of BANKS) {
      bankInfoMap[b.id] = b;
    }

    // 5. Cache for Bank documents: bankId (from HTML) → Bank mongoose doc
    const bankDocCache = {};

    /**
     * Resolves (and caches) the Bank document for a given HTML bankId.
     * Creates the bank if it doesn't exist.
     */
    async function resolveBank(bankId) {
      if (bankDocCache[bankId]) return bankDocCache[bankId];

      const info = bankInfoMap[bankId];
      if (!info) throw new Error(`No BANKS entry found for bankId "${bankId}".`);

      let bankDoc = await Bank.findOne({ name: info.name });
      if (!bankDoc) {
        bankDoc = await Bank.create({ name: info.name, code: info.short, isActive: true });
        console.log(`    [Bank CREATED] ${info.name} (${bankDoc._id})`);
      } else {
        console.log(`    [Bank EXISTS ] ${info.name} (${bankDoc._id})`);
      }

      bankDocCache[bankId] = bankDoc;
      return bankDoc;
    }

    // 6. Import loans
    let created = 0;
    let updated = 0;
    let errors  = 0;

    console.log('\nImporting loan products…\n');

    for (const loan of LOANS) {
      try {
        // Resolve bank
        const bankDoc = await resolveBank(loan.bankId);

        // Build the document fields
        const benefits        = featuresToHtml(loan.features);
        const feesEligibility = eligibilityToHtml(loan.eligibility);

        const fields = {
          name:                   loan.product,
          loanCategory:           'personal',
          bank:                   bankDoc._id,
          agency:                 agency._id,
          loanType:               loan.type,              // 'Islamic' | 'Conventional'
          interestRateRange:      loan.rateDisplay,
          rateMin:                loan.rateMin,
          rateMax:                loan.rateMax,
          rateType:               loan.rateType,
          rateBasis:              loan.rateBasis,
          minSalary:              loan.minSalary,
          maxAmountNum:           loan.maxAmount,
          maxAmountNote:          loan.maxAmountNote || '',
          tenureMaxMonths:        loan.tenureMax,
          salaryTransferRequired: loan.salaryTransferRequired, // null | true | false
          tags:                   Array.isArray(loan.tags) ? loan.tags : [],
          processingFee:          loan.processingFee   || '',
          earlySettlement:        loan.earlySettlement || '',
          lateFee:                loan.lateFee         || '',
          disclosedNote:          loan.disclosedNote   || '',
          source:                 loan.source          || '',
          sourceLabel:            loan.sourceLabel     || '',
          benefits,
          feesEligibility,
          isActive:               true,
        };

        // Upsert: match by product name (case-insensitive) + bank
        const filter = {
          name: { $regex: `^${escapeRegex(loan.product)}$`, $options: 'i' },
          bank: bankDoc._id,
        };

        const existing = await LoanProduct.findOne(filter);

        if (existing) {
          await LoanProduct.updateOne({ _id: existing._id }, { $set: fields });
          console.log(`  [UPDATED] ${bankDoc.name} — ${loan.product}`);
          updated++;
        } else {
          await LoanProduct.create(fields);
          console.log(`  [CREATED] ${bankDoc.name} — ${loan.product}`);
          created++;
        }
      } catch (err) {
        console.error(`  [ERROR ] Loan "${loan.product}" (id: ${loan.id}): ${err.message}`);
        errors++;
      }
    }

    // 7. Summary
    console.log('\n─────────────────────────────────────');
    console.log('Import complete.');
    console.log(`  Created : ${created}`);
    console.log(`  Updated : ${updated}`);
    console.log(`  Errors  : ${errors}`);
    console.log(`  Total   : ${LOANS.length}`);
    console.log('─────────────────────────────────────');
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
}

/** Escape special regex characters in a string (for use in RegExp). */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
