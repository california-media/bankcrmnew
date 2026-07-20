require('dotenv').config();
const mongoose = require('mongoose');
const XLSX = require('xlsx');

const MONGO_URI    = process.env.MONGO_URI;
const EXCEL_PATH   = process.env.EXCEL_PATH || '/Users/californiamediadubai/Documents/data/FAB PRODUCT FEE AND CHARGES.xlsx';
const AGENCY_EMAIL = process.env.AGENCY_EMAIL || 'mysilah@gmail.com';

const bracketSchema = new mongoose.Schema(
  { minimumSalary:{type:Number,required:true,min:0}, receivable:{type:Number,required:true,min:0}, payable:{type:Number,required:true,min:0}, feeType:{type:String,enum:['free','paid','free_tnc'],default:'free'} },
  {_id:false}
);
const CardProduct = mongoose.models.CardProduct || mongoose.model('CardProduct', new mongoose.Schema({
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
},{timestamps:true}));

const Bank = mongoose.models.Bank || mongoose.model('Bank', new mongoose.Schema({
  name:{type:String,required:true,trim:true},
  code:{type:String,trim:true},
  isActive:{type:Boolean,default:true},
},{timestamps:true}));

const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({email:String,role:String,name:String},{strict:false}));

const BANK_NAME_MAP = {
  'FAB':                     'First Abu Dhabi Bank',
  'DUBAI FIRST':             'Dubai First',
  'AJMAN':                   'Ajman Bank',
  'CBD':                     'Commercial Bank of Dubai',
  'HSBC':                    'HSBC',
  'CITI BANK':               'Citibank UAE',
  'SHARJAH ISLAMIC BANK':    'Sharjah Islamic Bank',
  'DEEM FINANCE':            'Deem Finance',
  'UAB':                     'United Arab Bank',
  'MAWARID':                 'Mawarid Finance',
  'AAFAQ ISLAMIC FINANCE':   'Aafaq Islamic Finance',
  'LIV BY ENBD':             'Liv. by Emirates NBD',
  'MASHREQ':                 'Mashreq',
  'WIO ':                    'Wio Bank',
  'STANDARD CHARTERED BANK': 'Standard Chartered Bank',
  'RAK':                     'RAKBANK',
  'INVEST BANK':             'Invest Bank',
  'MASHREQ AL ISLAMI':       'Mashreq Al Islami',
  'AL HILAL BANK':           'Al Hilal Bank',
  'ADCB':                    'ADCB',
  'DIB':                     'Dubai Islamic Bank',
  'ADIB':                    'ADIB',
  'EIB':                     'Emirates Islamic Bank',
  'ENBD':                    'Emirates NBD',
};

function findHeaderRow(rows) {
  for (let i = 0; i < rows.length; i++) {
    const s = String(rows[i][0] || '').trim().toUpperCase();
    if (s === 'S.NO' || s === 'S.NO.') return i;
  }
  return -1;
}

function parseFee(raw) {
  const s = String(raw || '').toUpperCase().trim();
  if (!s || s === '0') return 'free';
  if (s === 'NO ANNUAL FEE' || s === 'FREE' || s === 'FREE FOR LIFE') return 'free';
  if (s.startsWith('NO ANNUAL')) return 'free';
  if (s.includes('1ST YEAR FREE') || s.includes('FIRST YEAR FREE') || s.includes('YEAR FREE') ||
      (s.includes('FREE') && (s.includes('AED') || s.includes('WAIV')))) return 'free_tnc';
  return 'paid';
}

function guessCardType(name, f, r) {
  const t = (name + ' ' + (f||'') + ' ' + (r||'')).toLowerCase();
  if (t.includes('islamic') || t.includes('murabaha') || t.includes('takaful') || t.includes('sharia') || t.includes('shariah')) return 'legacy';
  if (t.includes('etihad') || t.includes('skywards') || t.includes('miles') || t.includes('voyager') ||
      t.includes('journey') || t.includes('travel card') || t.includes('airline')) return 'travel';
  if (t.includes('cashback') || t.includes('cash back') || t.includes('rewards') || t.includes('points') ||
      t.includes('smiles') || t.includes('adnoc') || t.includes('gems') || t.includes('liv card')) return 'rewards_lifestyle';
  if (t.includes('elite') || t.includes('infinite') || t.includes('world') ||
      t.includes('signature') || t.includes('premium') || t.includes('platinum')) return 'premium';
  return 'regular';
}

function toHtml(raw) {
  if (!raw) return '';
  const lines = String(raw).split(/\r?\n+/)
    .map(l => l.replace(/^\s*\d+[.)]\s*/, '').replace(/^[-•*]\s*/, '').trim())
    .filter(l => l.length > 3);
  return lines.length ? '<ul>' + lines.map(l => `<li>${l}</li>`).join('') + '</ul>' : '';
}

async function main() {
  console.log('Connecting…');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  const agency = await User.findOne({ email: AGENCY_EMAIL, role: 'agency' }).lean();
  if (!agency) { console.error('Agency not found: ' + AGENCY_EMAIL); process.exit(1); }
  console.log('Agency: ' + (agency.name||agency.email) + '\n');

  const wb = XLSX.readFile(EXCEL_PATH);
  let totalCreated = 0, totalUpdated = 0;

  for (const sheetName of wb.SheetNames) {
    const bankName = BANK_NAME_MAP[sheetName];
    if (!bankName) { console.log('? No mapping: ' + sheetName); continue; }

    let bank = await Bank.findOne({ name: new RegExp('^' + bankName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '$','i') });
    if (!bank) { bank = await Bank.create({ name: bankName, isActive: true }); console.log('  Bank created: ' + bankName); }

    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header:1, defval:null });
    const hi = findHeaderRow(rows);
    if (hi === -1) { console.log('  ! No header in: ' + sheetName); continue; }

    let created = 0, updated = 0;
    for (const row of rows.slice(hi + 1)) {
      const rawName = row[1];
      if (!rawName || typeof rawName !== 'string' || !rawName.trim()) continue;
      const sno = String(row[0]||'').trim();
      if (sno && isNaN(parseInt(sno)) && sno.length > 3) continue; // sub-header

      const name    = rawName.trim();
      const salary  = row[2] ? Number(row[2]) : 5000;
      const feeType = parseFee(row[3]);
      const cardType = guessCardType(name, row[6], row[7]);

      const kfsUrl = row[9] ? String(row[9]).trim() : '';
      const payload = {
        name, cardType,
        bank: bank._id,
        agency: agency._id,
        commissionBrackets: [{ minimumSalary: isNaN(salary)?5000:salary, receivable:0, payable:0, feeType }],
        benefits:      toHtml(row[7]) + toHtml(row[8]),
        feesEligibility: row[5] ? '<p>' + String(row[5]).trim() + '</p>' : '',
        keyFeatures:   toHtml(row[6]),
        isActive: true,
        redirectUrl: (kfsUrl && kfsUrl.startsWith('http')) ? kfsUrl : '',
      };

      const existing = await CardProduct.findOne({ name: new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '$','i'), bank: bank._id });
      if (existing) { await CardProduct.findByIdAndUpdate(existing._id, { $set: payload }); updated++; }
      else          { await CardProduct.create(payload); created++; }
    }

    console.log('  ' + bankName + ': +' + created + ' created, ' + updated + ' updated');
    totalCreated += created; totalUpdated += updated;
  }

  console.log('\nDone. Created: ' + totalCreated + ', Updated: ' + totalUpdated);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
