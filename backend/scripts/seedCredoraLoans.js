require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Bank = require('../models/Bank');
const LoanProduct = require('../models/LoanProduct');
const User = require('../models/User');

// [bankCode, loanCategory, name, interestRateRange, minSalary, maxLoanAmount, maxTenure, keyNotes]
const CREDORA_LOANS = [
  // Personal Loans
  ['ENBD',   'personal', 'Credora - ENBD Personal Loan',                   '5.99% – 18.99% reducing',              5000, 'Up to AED 4M (Nationals) / AED 2M (Expats)', 'Up to 48 months', 'Salary transfer preferred; Non-salary transfer available'],
  ['EIB',    'personal', 'Credora - Emirates Islamic Personal Finance',     '5.49% – 9.49% reducing (Profit Rate)', 5000, 'Up to AED 2M',                               'Up to 48 months', 'Sharia-compliant; Murabaha structure; salary transfer required'],
  ['RAK',    'personal', 'Credora - RAKBANK Personal Loan',                 '4.99% – 9.99% reducing',               5000, 'Up to 20x salary / AED 2.5M',               'Up to 48 months', 'Salary transfer to RAKBANK required; top-up available'],
  ['DIB',    'personal', 'Credora - DIB Personal Finance',                  '5.49% – 9.50% reducing (Profit Rate)', 3000, 'Up to AED 4M (Nationals), AED 2M (Expats)', 'Up to 48 months', 'Sharia-compliant Murabaha; low entry salary AED 3,000'],
  ['SIB',    'personal', 'Credora - Sharjah Islamic Personal Finance',      '5.99% – 10.00% reducing (Profit Rate)',5000, 'Up to AED 1.5M',                             'Up to 48 months', 'Sharia-compliant; salary transfer required'],
  ['Invest', 'personal', 'Credora - Invest Bank Personal Loan',             '6.50% – 12.00% reducing',              8000, 'Up to AED 500K',                             'Up to 48 months', 'Salary transfer required; UAE residents'],

  // Business Loans
  ['RAK',    'business', 'Credora - RAKBANK Business Loan',                 '8.00% – 14.00% reducing',              null, 'Up to AED 3M',                               'Up to 48 months', 'SME; Business RAKstarter; working capital'],
  ['DIB',    'business', 'Credora - DIB Business Finance',                  '7.50% – 14.50% reducing',              null, 'Up to AED 3M',                               'Up to 60 months', 'SME Sharia-compliant; Mudaraba / Musharaka'],
  ['Wio',    'business', 'Credora - Wio Business Loan',                     '6.99% – 12.00% reducing',              null, 'Up to AED 1M',                               'Up to 36 months', 'SME / freelancer business finance; digital-only'],
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const credora = await User.findOne({ email: 'credora@gmail.com', role: 'agency' }).lean();
  if (!credora) {
    console.error('Credora agency not found. Create agency with email credora@gmail.com first.');
    process.exit(1);
  }
  console.log(`Agency: ${credora.name || credora.email} (${credora._id})`);

  const banks = await Bank.find().lean();
  const bankMap = {};
  for (const b of banks) bankMap[b.code] = b._id;

  let created = 0;
  let updated = 0;

  for (const [bankCode, loanCategory, name, interestRateRange, minSalary, maxLoanAmount, maxTenure, keyNotes] of CREDORA_LOANS) {
    const bankId = bankMap[bankCode];
    if (!bankId) {
      console.warn(`  SKIP: bank code "${bankCode}" not found`);
      continue;
    }

    const bracket = minSalary ? [{ minimumSalary: minSalary, receivable: 1.5, payable: 1.0 }] : [];

    const existing = await LoanProduct.findOne({ name });
    if (existing) {
      Object.assign(existing, { loanCategory, bank: bankId, agency: credora._id, interestRateRange, minSalary, maxLoanAmount, maxTenure, keyNotes, commissionBrackets: bracket });
      await existing.save();
      updated++;
      console.log(`  Updated: ${name}`);
    } else {
      await LoanProduct.create({ name, loanCategory, bank: bankId, agency: credora._id, interestRateRange, minSalary, maxLoanAmount, maxTenure, keyNotes, commissionBrackets: bracket, isActive: true });
      created++;
      console.log(`  Created: ${name}`);
    }
  }

  console.log(`\nDone. Created: ${created}, Updated: ${updated}`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
