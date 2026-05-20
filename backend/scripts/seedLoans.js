require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Bank = require('../models/Bank');
const LoanProduct = require('../models/LoanProduct');

// [bankCode, loanCategory, name, interestRateRange, minSalary, maxLoanAmount, maxTenure, keyNotes]
const LOANS = [
  ['ENBD', 'personal',   'Emirates NBD Personal Loan',           '5.99% – 18.99% reducing',                        5000,  'Up to AED 4M (Nationals) / AED 2M (Expats)', 'Up to 48 months', 'Salary transfer preferred; Non-salary transfer available; 7-day return option'],
  ['ENBD', 'mortgage',   'Emirates NBD Mortgage Loan',           '3.99% – 4.99% fixed; EIBOR + margin variable',   15000, 'Up to 85% LTV (Nationals), 80% (Expats)',    'Up to 25 years',  'Fixed 1–5 yr, then variable; min property value AED 500K'],
  ['ENBD', 'investor',   'Emirates NBD Investor Loan',           '4.49% – 5.49% reducing',                         15000, 'Up to 75% LTV investment property',          'Up to 25 years',  'Buy-to-let / investment property; non-resident also available'],
  ['ENBD', 'business',   'Emirates NBD Business Loan',           '7.00% – 14.00% reducing',                        null,  'Up to AED 3M',                               'Up to 48 months', 'SME / working capital; min 1 yr business operation'],
  ['ENBD', 'auto_loan',  'Emirates NBD Auto Loan',               '1.99% – 3.99% flat',                             5000,  'Up to 80% of vehicle value',                 'Up to 60 months', 'New & used vehicles; 20% down payment required'],

  ['EIB',  'personal',   'Emirates Islamic Personal Finance',    '5.49% – 9.49% reducing (Profit Rate)',           5000,  'Up to AED 2M',                               'Up to 48 months', 'Sharia-compliant; Murabaha structure; salary transfer required'],
  ['EIB',  'mortgage',   'Emirates Islamic Home Finance',        '3.99% – 4.75% fixed; EIBOR + margin variable',   10000, 'Up to 85% LTV (Nationals), 80% (Expats)',    'Up to 25 years',  'Diminishing Musharaka; freehold properties in UAE'],
  ['EIB',  'investor',   'Emirates Islamic Investment Finance',  '4.49% – 5.50% reducing',                         15000, 'Up to 75% LTV',                              'Up to 25 years',  'Investment property; Islamic structure'],
  ['EIB',  'business',   'Emirates Islamic Business Finance',    '7.50% – 15.00% reducing',                        null,  'Up to AED 2M',                               'Up to 48 months', 'SME; Sharia-compliant; min 2 yrs business'],
  ['EIB',  'auto_loan',  'Emirates Islamic Vehicle Finance',     '2.15% – 3.50% flat',                             5000,  'Up to 80% vehicle value',                    'Up to 60 months', 'New & used; Ijarah / Murabaha structure'],

  ['CBD',  'personal',   'CBD Personal Loan',                    '5.75% – 9.99% reducing',                         8000,  'Up to AED 1M',                               'Up to 48 months', 'Salary transfer required; both Nationals & Expats'],
  ['CBD',  'mortgage',   'CBD Mortgage Loan',                    '4.00% – 4.99% fixed; EIBOR + margin',            10000, 'Up to 85% LTV (Nationals), 80% (Expats)',    'Up to 25 years',  'Ready & off-plan properties; fixed 1–3 yr option'],
  ['CBD',  'investor',   'CBD Investor Loan',                    '4.50% – 5.50% reducing',                         15000, 'Up to 75% LTV investment property',          'Up to 20 years',  'Residential investment property'],
  ['CBD',  'business',   'CBD Business Loan',                    '8.00% – 15.00% reducing',                        null,  'Up to AED 2M',                               'Up to 60 months', 'SME finance; overdraft & term loan options'],
  ['CBD',  'auto_loan',  'CBD Auto Loan',                        '2.00% – 3.75% flat',                             8000,  'Up to 80% vehicle value',                    'Up to 60 months', 'New & pre-owned vehicles'],

  ['FAB',  'personal',   'FAB Personal Loan',                    '5.34% – 7.34% reducing',                         5000,  'Up to AED 5M (Nationals), AED 2M (Expats)', 'Up to 48 months', 'Best rate with salary transfer + FAB card; 120-day 1st EMI grace'],
  ['FAB',  'mortgage',   'FAB Mortgage Loan',                    '3.99% – 4.49% fixed; EIBOR + margin',            10000, 'Up to 85% LTV (Nationals), 80% (Expats)',    'Up to 25 years',  '1/3/5 yr fixed options; competitive variable follow-on rates'],
  ['FAB',  'investor',   'FAB Investor Loan',                    '4.25% – 5.25% reducing',                         15000, 'Up to 75% LTV',                              'Up to 25 years',  'Non-resident investor loan also available'],
  ['FAB',  'business',   'FAB Business Loan',                    '7.00% – 13.00% reducing',                        null,  'Up to AED 5M',                               'Up to 60 months', 'SME & corporate; working capital, term loans, overdraft'],
  ['FAB',  'auto_loan',  'FAB Auto Loan',                        '1.99% – 3.50% flat',                             5000,  'Up to 80% vehicle value',                    'Up to 60 months', 'New & used; quick approval; dealer tie-ups'],

  ['RAK',  'personal',   'RAKBANK Personal Loan',                '4.99% – 9.99% reducing',                         5000,  'Up to 20x salary / AED 2.5M',               'Up to 48 months', 'Salary transfer to RAKBANK required; top-up available'],
  ['RAK',  'mortgage',   'RAKBANK Mortgage Loan',                '4.09% – 5.39% fixed; EIBOR +1.20%–1.99% variable', 10000, 'Up to 85% LTV (Nationals), 80% (Expats)', 'Up to 25 years',  'Home-in-One offset mortgage; 3-yr fixed option from 5.09%'],
  ['RAK',  'investor',   'RAKBANK Investor Loan',                '4.49% – 5.49% reducing',                         10000, 'Up to 75% LTV',                              'Up to 25 years',  'Investment property; ready & off-plan'],
  ['RAK',  'business',   'RAKBANK Business Loan',                '8.00% – 14.00% reducing',                        null,  'Up to AED 3M',                               'Up to 48 months', 'SME; Business RAKstarter; working capital'],
  ['RAK',  'auto_loan',  'RAKBANK Auto Loan',                    '1.79% – 3.65% flat',                             5000,  'Up to 80% vehicle value',                    'Up to 60 months', 'No salary transfer required; salaried & self-employed'],

  ['DIB',  'personal',   'DIB Personal Finance',                 '5.49% – 9.50% reducing (Profit Rate)',           3000,  'Up to AED 4M (Nationals), AED 2M (Expats)', 'Up to 48 months', 'Sharia-compliant Murabaha; low entry salary AED 3,000'],
  ['DIB',  'mortgage',   'DIB Home Finance',                     '3.99% – 4.50% fixed; EIBOR + margin',            10000, 'Up to 90% LTV (Nationals), 80% (Expats)',    'Up to 25 years',  'Diminishing Musharaka; highest LTV 90% for Nationals'],
  ['DIB',  'investor',   'DIB Investment Finance',               '4.25% – 5.25% reducing',                         10000, 'Up to 75% LTV',                              'Up to 25 years',  'Investment / buy-to-let; Islamic structure'],
  ['DIB',  'business',   'DIB Business Finance',                 '7.50% – 14.50% reducing',                        null,  'Up to AED 3M',                               'Up to 60 months', 'SME Sharia-compliant; Mudaraba / Musharaka'],
  ['DIB',  'auto_loan',  'DIB Vehicle Finance',                  '1.99% – 3.50% flat',                             5000,  'Up to 80% vehicle value',                    'Up to 60 months', 'Ijarah structure; new & used vehicles'],

  ['SIB',  'personal',   'SIB Personal Finance',                 '5.99% – 10.00% reducing (Profit Rate)',          5000,  'Up to AED 1.5M',                             'Up to 48 months', 'Sharia-compliant; salary transfer required'],
  ['SIB',  'mortgage',   'SIB Home Finance',                     '4.00% – 4.75% fixed (Profit Rate)',              10000, 'Up to 80% LTV',                              'Up to 25 years',  'Diminishing Musharaka; freehold UAE properties'],
  ['SIB',  'investor',   'SIB Investor Loan',                    '4.50% – 5.50% reducing',                         10000, 'Up to 75% LTV',                              'Up to 20 years',  'Investment property finance; Islamic structure'],
  ['SIB',  'business',   'SIB Business Loan',                    '8.00% – 15.00% reducing',                        null,  'Up to AED 1.5M',                             'Up to 48 months', 'SME; Murabaha trade finance'],
  ['SIB',  'auto_loan',  'SIB Vehicle Finance',                  '2.15% – 3.75% flat',                             5000,  'Up to 80% vehicle value',                    'Up to 60 months', 'Ijarah structure; new & used'],

  ['Deem', 'personal',   'Deem Finance Personal Loan',           '12.00% – 18.99% reducing',                       5000,  'Up to AED 300K',                             'Up to 48 months', 'No salary transfer required; approved for non-listed companies'],

  ['Ajman','personal',   'Ajman Bank Personal Finance',          '6.00% – 10.50% reducing (Profit Rate)',          5000,  'Up to AED 1M',                               'Up to 48 months', 'Sharia-compliant; salary transfer to Ajman Bank required'],
  ['Ajman','mortgage',   'Ajman Bank Home Finance',              '4.00% – 4.99% fixed (Profit Rate)',              10000, 'Up to 85% LTV (Nationals), 80% (Expats)',    'Up to 25 years',  'Diminishing Musharaka; freehold properties'],
  ['Ajman','investor',   'Ajman Bank Investor Loan',             '4.50% – 5.50% reducing',                         10000, 'Up to 75% LTV',                              'Up to 20 years',  'Investment property in approved locations'],
  ['Ajman','business',   'Ajman Bank Business Loan',             '8.50% – 15.00% reducing',                        null,  'Up to AED 1M',                               'Up to 48 months', 'SME; Murabaha structure; 2 yrs min operation'],
  ['Ajman','auto_loan',  'Ajman Bank Vehicle Finance',           '2.25% – 3.99% flat',                             5000,  'Up to 80% vehicle value',                    'Up to 60 months', 'New vehicles; Ijarah structure'],

  ['Mashreq','personal', 'Mashreq Personal Loan',                '5.50% – 9.99% reducing',                         5000,  'Up to 20x salary / AED 2M',                 'Up to 48 months', 'Salary transfer mandatory; available for unapproved companies at higher rate'],
  ['Mashreq','mortgage', 'Mashreq Mortgage Loan',                '4.10% – 4.99% fixed; EIBOR +1.49%+ variable',   10000, 'Up to 85% LTV (Nationals), 80% (Expats)',    'Up to 25 years',  'Zero processing fee promos; fixed & variable options; ready & off-plan'],
  ['Mashreq','investor', 'Mashreq Investor Loan',                '4.49% – 5.49% reducing',                         15000, 'Up to 75% LTV',                              'Up to 25 years',  'Investment / non-resident buy-to-let available'],
  ['Mashreq','business', 'Mashreq Business Loan',                '7.50% – 14.00% reducing',                        null,  'Up to AED 3M',                               'Up to 60 months', 'SME Neobiz; working capital & term loans'],
  ['Mashreq','auto_loan','Mashreq Auto Loan',                    '2.00% – 3.75% flat',                             5000,  'Up to 80% vehicle value',                    'Up to 60 months', 'New & used; quick online approval'],

  ['Aafaq','personal',   'Aafaq Personal Finance',               '6.50% – 11.00% reducing (Profit Rate)',          5000,  'Up to AED 500K',                             'Up to 48 months', 'Sharia-compliant Murabaha; quick approval'],

  ['Invest','personal',  'Invest Bank Personal Loan',            '6.50% – 12.00% reducing',                        8000,  'Up to AED 500K',                             'Up to 48 months', 'Salary transfer required; UAE residents'],
  ['Invest','mortgage',  'Invest Bank Mortgage Loan',            '4.25% – 5.25% fixed (Profit Rate)',              10000, 'Up to 80% LTV',                              'Up to 25 years',  'Ready properties; UAE nationals & expats'],
  ['Invest','investor',  'Invest Bank Investor Loan',            '4.75% – 5.75% reducing',                         15000, 'Up to 70% LTV',                              'Up to 20 years',  'Investment residential property'],
  ['Invest','business',  'Invest Bank Business Loan',            '8.50% – 15.00% reducing',                        null,  'Up to AED 1M',                               'Up to 48 months', 'SME trade finance & working capital'],
  ['Invest','auto_loan', 'Invest Bank Auto Loan',                '2.50% – 4.00% flat',                             8000,  'Up to 80% vehicle value',                    'Up to 48 months', 'New vehicles only'],

  ['UAB',  'personal',   'UAB Personal Loan',                    '6.25% – 11.50% reducing',                        5000,  'Up to AED 500K',                             'Up to 48 months', 'Salary transfer required; salaried employees'],
  ['UAB',  'mortgage',   'UAB Mortgage Loan',                    '4.00% – 5.00% fixed',                            10000, 'Up to 80% LTV',                              'Up to 25 years',  'Ready residential properties; fixed rate initial period'],
  ['UAB',  'investor',   'UAB Investor Loan',                    '4.75% – 5.75% reducing',                         12000, 'Up to 70% LTV',                              'Up to 20 years',  'Buy-to-let investment property'],
  ['UAB',  'business',   'UAB Business Loan',                    '9.00% – 15.00% reducing',                        null,  'Up to AED 1M',                               'Up to 48 months', 'SME loans; overdraft facility'],
  ['UAB',  'auto_loan',  'UAB Auto Loan',                        '2.50% – 3.99% flat',                             5000,  'Up to 80% vehicle value',                    'Up to 48 months', 'New & used vehicles'],

  ['Mawarid','personal', 'Mawarid Finance Personal Finance',     '6.50% – 12.00% reducing (Profit Rate)',          5000,  'Up to AED 300K',                             'Up to 48 months', 'Sharia-compliant Murabaha; salary transfer required'],
  ['Mawarid','auto_loan','Mawarid Finance Vehicle Finance',      '2.50% – 4.25% flat',                             5000,  'Up to 80% vehicle value',                    'Up to 48 months', 'Ijarah structure; new vehicles'],

  ['Arab',  'personal',  'Arab Bank Personal Loan',              '6.50% – 12.50% reducing',                        5000,  'Up to AED 500K',                             'Up to 48 months', 'Salary transfer required; UAE residents'],
  ['Arab',  'mortgage',  'Arab Bank Mortgage Loan',              '4.25% – 5.25% fixed',                            10000, 'Up to 80% LTV',                              'Up to 25 years',  'Ready residential; fixed initial period'],
  ['Arab',  'investor',  'Arab Bank Investor Loan',              '5.00% – 6.00% reducing',                         12000, 'Up to 70% LTV',                              'Up to 20 years',  'Residential investment property'],
  ['Arab',  'business',  'Arab Bank Business Loan',              '9.00% – 15.00% reducing',                        null,  'Up to AED 1M',                               'Up to 48 months', 'SME trade finance'],
  ['Arab',  'auto_loan', 'Arab Bank Auto Loan',                  '2.50% – 4.00% flat',                             5000,  'Up to 80% vehicle value',                    'Up to 48 months', 'New vehicles; standard conditions'],

  ['Wio',   'business',  'Wio Business Loan',                    '6.99% – 12.00% reducing',                        null,  'Up to AED 1M',                               'Up to 36 months', 'SME / freelancer business finance; digital-only'],
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const banks = await Bank.find();
  const bankMap = {};
  for (const b of banks) bankMap[b.code] = b._id;

  let created = 0;
  let updated = 0;

  for (const [bankCode, loanCategory, name, interestRateRange, minSalary, maxLoanAmount, maxTenure, keyNotes] of LOANS) {
    const bankId = bankMap[bankCode];
    if (!bankId) {
      console.warn(`  SKIP: bank code "${bankCode}" not found`);
      continue;
    }

    const bracket = minSalary ? [{ minimumSalary: minSalary, receivable: 1.5, payable: 1.0 }] : [];

    const existing = await LoanProduct.findOne({ name });
    if (existing) {
      Object.assign(existing, { loanCategory, bank: bankId, interestRateRange, minSalary, maxLoanAmount, maxTenure, keyNotes, commissionBrackets: bracket });
      await existing.save();
      updated++;
      console.log(`  Updated: ${name}`);
    } else {
      await LoanProduct.create({ name, loanCategory, bank: bankId, interestRateRange, minSalary, maxLoanAmount, maxTenure, keyNotes, commissionBrackets: bracket, isActive: true });
      created++;
      console.log(`  Created: ${name}`);
    }
  }

  console.log(`\nDone. Created: ${created}, Updated: ${updated}`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
