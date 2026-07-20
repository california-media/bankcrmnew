/**
 * Import card products from FAB PRODUCT FEE AND CHARGES.xlsx
 * Usage: node import_cards.js
 */

const mongoose = require('mongoose');
const XLSX    = require('xlsx');
const path    = require('path');

const MONGO_URI = 'mongodb+srv://bankcrm:T4w7kwlqqxHZ6Wln@bankcrm.qnycdid.mongodb.net/?appName=bankcrm';
const EXCEL_PATH = '/Users/californiamediadubai/Documents/data/FAB PRODUCT FEE AND CHARGES.xlsx';
const AGENCY_EMAIL = 'mysilah@gmail.com';

// ── Models (inline to avoid env dependency) ────────────────────────────
const bracketSchema = new mongoose.Schema(
  { minimumSalary:{type:Number,required:true,min:0}, receivable:{type:Number,required:true,min:0}, payable:{type:Number,required:true,min:0}, feeType:{type:String,enum:['free','paid','free_tnc'],default:'free'} },
  {_id:false}
);
const cardProductSchema = new mongoose.Schema({
  name:{type:String,required:true,trim:true},
  cardType:{type:String,enum:['regular','premium','rewards_lifestyle','travel','ecommerce','legacy'],required:true},
  bank:{type:mongoose.Schema.Types.ObjectId,ref:'Bank',required:true},
  agency:{type:mongoose.Schema.Types.ObjectId,ref:'User'},
  commissionBrackets:{type:[bracketSchema],default:[]},
  cashbackCategories:{type:[],default:[]},
  benefits:{type:String,default:''},
  feesEligibility:{type:String,default:''},
  keyFeatures:{type:String,default:''},
  clawbackMonths:{type:Number,default:0},
  clawbackDays:{type:Number,default:30},
  isActive:{type:Boolean,default:true},
  cardImage:{type:String,trim:true},
  redirectUrl:{type:String,trim:true},
  redirectActive:{type:Boolean,default:false},
},{timestamps:true});

const bankSchema = new mongoose.Schema({
  name:{type:String,required:true,trim:true},
  code:{type:String,trim:true},
  isActive:{type:Boolean,default:true},
},{timestamps:true});

const userSchema = new mongoose.Schema({email:String,role:String,name:String,isActive:Boolean},{strict:false});

const Bank        = mongoose.models.Bank        || mongoose.model('Bank', bankSchema);
const CardProduct = mongoose.models.CardProduct || mongoose.model('CardProduct', cardProductSchema);
const User        = mongoose.models.User        || mongoose.model('User', userSchema);

// ── Sheet → Bank name mapping ──────────────────────────────────────────
const BANK_NAME_MAP = {
  'FAB':                    'First Abu Dhabi Bank',
  'DUBAI FIRST':            'Dubai First',
  'AJMAN':                  'Ajman Bank',
  'CBD':                    'Commercial Bank of Dubai',
  'HSBC':                   'HSBC',
  'CITI BANK':              'Citibank UAE',
  'SHARJAH ISLAMIC BANK':   'Sharjah Islamic Bank',
  'DEEM FINANCE':           'Deem Finance',
  'UAB':                    'United Arab Bank',
  'MAWARID':                'Mawarid Finance',
  'AAFAQ ISLAMIC FINANCE':  'Aafaq Islamic Finance',
  'LIV BY ENBD':            'Liv. by Emirates NBD',
  'MASHREQ':                'Mashreq',
  'WIO ':                   'Wio Bank',
  'STANDARD CHARTERED BANK':'Standard Chartered Bank',
  'RAK':                    'RAKBANK',
  'INVEST BANK':            'Invest Bank',
  'MASHREQ AL ISLAMI':      'Mashreq Al Islami',
  'AL HILAL BANK':          'Al Hilal Bank',
  'ADCB':                   'ADCB',
  'DIB':                    'Dubai Islamic Bank',
  'ADIB':                   'ADIB',
  'EIB':                    'Emirates Islamic Bank',
  'ENBD':                   'Emirates NBD',
};

// ── Column offsets per sheet family ──────────────────────────────────
function getColOffset(sheetName) {
  if (sheetName === 'FAB') return 3;
  if (sheetName === 'DUBAI FIRST') return 2;
  return 5;
}

// ── Parse annual fee string → feeType + numeric value ─────────────────
function parseFee(feeRaw) {
  if (!feeRaw && feeRaw !== 0) return { feeType: 'paid', amount: 0 };
  const s = String(feeRaw).toUpperCase().trim();
  if (s === '0' || s.includes('NO ANNUAL FEE') || s.includes('FREE FOR LIFE') || s === 'FREE') {
    return { feeType: 'free', amount: 0 };
  }
  if (s.includes('FREE') && (s.includes('1ST YEAR') || s.includes('FIRST YEAR') || s.includes('WAIV'))) {
    const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
    return { feeType: 'free_tnc', amount: n || 0 };
  }
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
  return { feeType: 'paid', amount: n || 0 };
}

// ── Guess cardType from name/features ─────────────────────────────────
function guessCardType(name, featureText) {
  const n = (name + ' ' + (featureText || '')).toLowerCase();
  if (n.includes('islamic') || n.includes('murabaha') || n.includes('takaful') || n.includes('halal')) return 'legacy';
  if (n.includes('travel') || n.includes('miles') || n.includes('etihad') || n.includes('skywards') ||
      n.includes('voyager') || n.includes('journey') || n.includes('lounge') || n.includes('airline')) return 'travel';
  if (n.includes('cashback') || n.includes('cash back') || n.includes('rewards') || n.includes('points') ||
      n.includes('share ') || n.includes('smiles') || n.includes('adnoc') || n.includes('gems')) return 'rewards_lifestyle';
  if (n.includes('elite') || n.includes('infinite') || n.includes('world') || n.includes('premium') ||
      n.includes('signature') || n.includes('platinum')) return 'premium';
  return 'regular';
}

// ── Convert plain bullet text → HTML list ─────────────────────────────
function textToHtml(text) {
  if (!text) return '';
  const lines = String(text).split(/\n+/).map(l => l.replace(/^\d+\.\s*/, '').replace(/^[-•]\s*/, '').trim()).filter(l => l.length > 2);
  if (!lines.length) return '';
  return '<ul>' + lines.map(l => `<li>${l}</li>`).join('') + '</ul>';
}

// ── Find header row in a sheet ─────────────────────────────────────────
function findHeaderRow(rows, colOffset) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sno = row[colOffset];
    const pname = row[colOffset + 1];
    if (String(sno || '').includes('S.NO') || String(pname || '').toUpperCase().includes('PRODUCT NAME')) {
      return i;
    }
  }
  return -1;
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  // Find agency
  const agency = await User.findOne({ email: AGENCY_EMAIL, role: 'agency' }).lean();
  if (!agency) { console.error(`Agency not found: ${AGENCY_EMAIL}`); process.exit(1); }
  console.log(`Agency: ${agency.name || agency.email} (${agency._id})`);

  const wb = XLSX.readFile(EXCEL_PATH);
  let totalCreated = 0, totalUpdated = 0, totalSkipped = 0;

  for (const sheetName of wb.SheetNames) {
    const bankName = BANK_NAME_MAP[sheetName];
    if (!bankName) { console.log(`⚠ No bank mapping for sheet "${sheetName}", skipping`); continue; }

    // Find or create bank
    let bank = await Bank.findOne({ name: { $regex: new RegExp('^' + bankName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') } });
    if (!bank) {
      bank = await Bank.create({ name: bankName, isActive: true });
      console.log(`  🏦 Created bank: ${bankName}`);
    }

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const colOffset = getColOffset(sheetName);
    const headerIdx = findHeaderRow(rows, colOffset);
    if (headerIdx === -1) { console.log(`  ⚠ Header not found in sheet "${sheetName}"`); continue; }

    const dataRows = rows.slice(headerIdx + 1);
    let sheetCreated = 0, sheetUpdated = 0;

    for (const row of dataRows) {
      const productName = row[colOffset + 1];
      if (!productName || String(productName).trim() === '' || String(productName).toUpperCase().includes('ISLAMIC CARDS')) continue;
      const name = String(productName).trim();

      const salaryRaw = row[colOffset + 2];
      const feeRaw    = row[colOffset + 3];
      const rateRaw   = row[colOffset + 4];
      const offerText = row[colOffset + 5];
      const keyFeatText = row[colOffset + 6];
      const rewardsText = row[colOffset + 7];
      const addlText  = row[colOffset + 8];
      const kfsUrl    = row[colOffset + 9];

      const salary = salaryRaw ? Number(salaryRaw) : 5000;
      const { feeType, amount: feeAmount } = parseFee(feeRaw);
      const rateNum = rateRaw ? (typeof rateRaw === 'number' ? rateRaw * 100 : parseFloat(String(rateRaw).replace(/[^0-9.]/g, ''))) : 0;

      // Build combined benefits HTML: rewards + additional
      const benefitsHtml = textToHtml(rewardsText) + (addlText ? textToHtml(addlText) : '');
      const keyFeaturesHtml = textToHtml(keyFeatText);

      // feesEligibility: offerText as a short plain-text block
      const feesHtml = offerText ? `<p>${String(offerText).trim()}</p>` : '';

      const cardType = guessCardType(name, String(keyFeatText || '') + ' ' + String(rewardsText || ''));

      // Commission bracket: receivable=0, payable=0, feeType from parsed fee
      const commissionBrackets = [{
        minimumSalary: isNaN(salary) ? 5000 : salary,
        receivable: 0,
        payable: 0,
        feeType,
      }];

      const existing = await CardProduct.findOne({ name: { $regex: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }, bank: bank._id });

      const payload = {
        name,
        cardType,
        bank: bank._id,
        agency: agency._id,
        commissionBrackets,
        benefits: benefitsHtml,
        feesEligibility: feesHtml,
        keyFeatures: keyFeaturesHtml,
        isActive: true,
      };

      if (existing) {
        await CardProduct.findByIdAndUpdate(existing._id, { $set: payload });
        sheetUpdated++;
      } else {
        await CardProduct.create(payload);
        sheetCreated++;
      }
    }

    console.log(`  ✅ ${bankName}: +${sheetCreated} created, ~${sheetUpdated} updated`);
    totalCreated += sheetCreated;
    totalUpdated += sheetUpdated;
  }

  console.log(`\nDone. Total created: ${totalCreated}, updated: ${totalUpdated}, skipped: ${totalSkipped}`);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
