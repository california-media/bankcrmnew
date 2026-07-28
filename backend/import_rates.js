const mongoose = require('mongoose');
const XLSX     = require('xlsx');
require('dotenv').config();

const Bank        = require('./models/Bank');
const CardProduct = require('./models/CardProduct');

const XLS = '/Users/californiamediadubai/Documents/data/FAB PRODUCT FEE AND CHARGES.xlsx';

// Sheet name → DB bank name(s) to search
const SHEET_BANK = {
  'FAB':                    ['First Abu Dhabi Bank'],
  'DUBAI FIRST':            ['Dubai First'],
  'AJMAN':                  ['Ajman Bank'],
  'CBD':                    ['Commercial Bank of Dubai'],
  'HSBC':                   ['HSBC'],
  'CITI BANK':              ['Citibank', 'Citi Bank', 'Citibank UAE'],
  'SHARJAH ISLAMIC BANK':   ['Sharjah Islamic Bank'],
  'DEEM FINANCE':           ['Deem Finance'],
  'UAB':                    ['United Arab Bank'],
  'MAWARID':                ['Mawarid Finance'],
  'AAFAQ ISLAMIC FINANCE':  ['Aafaq Islamic Finance'],
  'LIV BY ENBD':            ['Liv. by Emirates NBD'],
  'MASHREQ':                ['Mashreq', 'Mashreq Bank'],
  'WIO ':                   ['Wio Bank'],
  'STANDARD CHARTERED BANK':['Standard Chartered Bank'],
  'RAK':                    ['RAKBANK', 'National Bank of Ras Al Khaimah', 'RAKBank'],
  'INVEST BANK':            ['Invest Bank'],
  'MASHREQ AL ISLAMI':      ['Mashreq Al Islami'],
  'AL HILAL BANK':          ['Al Hilal Bank'],
  'ADCB':                   ['ADCB'],
  'DIB':                    ['Dubai Islamic Bank'],
  'ADIB':                   ['ADIB', 'Abu Dhabi Islamic Bank'],
  'EIB':                    ['Emirates Islamic Bank', 'Emirates Islamic'],
  'ENBD':                   ['Emirates NBD'],
};

function norm(s) {
  return String(s || '').toLowerCase().replace(/[-_®™]/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}
function wordScore(a, b) {
  const wa = norm(a).split(' ').filter(w => w.length > 2);
  const nb = norm(b);
  return wa.filter(w => nb.includes(w)).length;
}

function formatRate(raw) {
  if (!raw && raw !== 0) return null;
  const s = String(raw).trim();
  // Already a nice string
  if (s.includes('%')) return s;
  // Decimal like 0.0399
  const n = parseFloat(s);
  if (!isNaN(n) && n > 0 && n < 1) {
    return (n * 100).toFixed(2).replace(/\.?0+$/, '') + '%/mo';
  }
  return s || null;
}

async function main() {
  console.log('Connecting…');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.\n');

  const wb = XLSX.readFile(XLS);
  let updated = 0, unmatched = 0;

  for (const sheetName of wb.SheetNames) {
    const bankNames = SHEET_BANK[sheetName];
    if (!bankNames) { console.log(`? No mapping for sheet: "${sheetName}"`); continue; }

    // Find bank(s) in DB
    const banks = await Bank.find({ name: { $in: bankNames.map(n => new RegExp('^' + n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '$','i')) } }).lean();
    if (!banks.length) {
      // Try partial match
      const partials = await Bank.find({ name: { $regex: bankNames[0].split(' ')[0], $options:'i' } }).lean();
      if (!partials.length) { console.log(`? Bank not found: ${bankNames[0]}`); continue; }
      banks.push(...partials);
    }

    const bankIds = banks.map(b => b._id);
    const cards   = await CardProduct.find({ bank: { $in: bankIds } }).lean();

    const ws   = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const dataRows = rows.filter(r => r[0] && typeof r[0] === 'number' && r[1]);

    console.log(`\n[${sheetName}] ${banks.map(b=>b.name).join('/')} — ${dataRows.length} rows, ${cards.length} DB cards`);

    for (const row of dataRows) {
      const excelName = String(row[1]).trim();
      const rateRaw   = row[4];
      const rate      = formatRate(rateRaw);

      if (!rate) { console.log(`  — skip (no rate): ${excelName}`); continue; }

      // Find best matching card
      let best = null, bestScore = 0;
      for (const card of cards) {
        const s = wordScore(excelName, card.name);
        if (s > bestScore) { bestScore = s; best = card; }
      }

      if (!best || bestScore < 2) {
        console.log(`  ✗ No match (score ${bestScore}): ${excelName}`);
        unmatched++;
        continue;
      }

      await CardProduct.findByIdAndUpdate(best._id, { $set: { rate } });
      updated++;
      console.log(`  ✓ "${best.name}" ← ${rate}${bestScore < 3 ? ' [score '+bestScore+']' : ''}`);
    }
  }

  console.log(`\n🎉 Done. Updated: ${updated}, Unmatched: ${unmatched}`);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
