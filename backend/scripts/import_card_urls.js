/**
 * Import kfsUrl + tncUrl from inzigo-site/mysilah_cards_backend.xlsx → Cards sheet
 * Run: node scripts/import_card_urls.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const XLSX     = require('xlsx');
const path     = require('path');

const CardProduct = require('../models/CardProduct');

const XLSX_PATH = path.join(__dirname, '../../inzigo-site/mysilah_cards_backend.xlsx');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const wb       = XLSX.readFile(XLSX_PATH);
  const cardRows = XLSX.utils.sheet_to_json(wb.Sheets['Cards'], { defval: null });

  let updated = 0, notFound = 0, skipped = 0;

  for (const row of cardRows) {
    const kfs = (row.key_facts_statement_url || '').trim();
    const tnc = (row.terms_conditions_url    || '').trim();
    if (!kfs && !tnc) { skipped++; continue; }

    const cardName = (row.card_name || '').trim();
    if (!cardName) { skipped++; continue; }

    const card = await CardProduct.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(cardName)}$`, 'i') },
    });
    if (!card) {
      console.warn(`  [MISS] "${cardName}" (${row.card_id})`);
      notFound++;
      continue;
    }

    await CardProduct.updateOne(
      { _id: card._id },
      { $set: { kfsUrl: kfs, tncUrl: tnc } }
    );
    console.log(`  [SET] ${cardName}`);
    if (kfs) console.log(`        KFS: ${kfs}`);
    if (tnc) console.log(`        T&C: ${tnc}`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}  Not found: ${notFound}  Skipped (no URL): ${skipped}`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
