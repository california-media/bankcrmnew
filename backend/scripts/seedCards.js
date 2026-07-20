require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Bank = require('../models/Bank');
const CardProduct = require('../models/CardProduct');

const BANKS = [
  { name: 'Emirates NBD', code: 'ENBD' },
  { name: 'Emirates Islamic Bank', code: 'EIB' },
  { name: 'Commercial Bank of Dubai', code: 'CBD' },
  { name: 'First Abu Dhabi Bank', code: 'FAB' },
  { name: 'National Bank of Ras Al Khaimah', code: 'RAK' },
  { name: 'Dubai Islamic Bank', code: 'DIB' },
  { name: 'Sharjah Islamic Bank', code: 'SIB' },
  { name: 'Deem Finance', code: 'Deem' },
  { name: 'Ajman Bank', code: 'Ajman' },
  { name: 'Mashreq Bank', code: 'Mashreq' },
  { name: 'Aafaq Islamic Finance', code: 'Aafaq' },
  { name: 'Invest Bank', code: 'Invest' },
  { name: 'United Arab Bank', code: 'UAB' },
  { name: 'Mawarid Finance', code: 'Mawarid' },
  { name: 'Arab Bank', code: 'Arab' },
  { name: 'Wio Bank', code: 'Wio' },
];

const TYPE_MAP = {
  'Regular': 'regular',
  'Premium': 'premium',
  'Rewards & Lifestyle': 'rewards_lifestyle',
  'Travel': 'travel',
  'E-Commerce': 'ecommerce',
  'Legacy': 'legacy',
};

// Commission defaults by card type
const COMMISSION_MAP = {
  premium: { receivable: 1000, payable: 800 },
  legacy:  { receivable: 1000, payable: 800 },
  default: { receivable: 700,  payable: 600  },
};

// [bankCode, cardName, minSalary, cardTypeLabel]
const CARDS = [
  ['ENBD', 'Emirates NBD Titanium Credit Card', 5000, 'Regular'],
  ['ENBD', 'Emirates NBD Go4it Gold Credit Card', 6000, 'Rewards & Lifestyle'],
  ['ENBD', 'Emirates NBD Lulu 247 Titanium Credit Card', 5000, 'Rewards & Lifestyle'],
  ['ENBD', 'Emirates NBD Lulu 247 Platinum Credit Card', 15000, 'Rewards & Lifestyle'],
  ['ENBD', 'Emirates NBD MasterCard Titanium Credit Card', 5000, 'Regular'],
  ['ENBD', 'Emirates NBD Manchester United Credit Card', 5000, 'Rewards & Lifestyle'],
  ['ENBD', 'Emirates NBD SHARE Visa Signature Credit Card', 12000, 'Rewards & Lifestyle'],
  ['ENBD', 'Emirates NBD SHARE Visa Platinum Credit Card', 8000, 'Rewards & Lifestyle'],
  ['ENBD', 'Emirates NBD U By Emaar Visa Family Card', 5000, 'Rewards & Lifestyle'],
  ['ENBD', 'Emirates NBD U By Emaar Visa Infinite Credit Card', 30000, 'Legacy'],
  ['ENBD', 'Emirates NBD Skywards Signature Credit Card', 12000, 'Travel'],
  ['ENBD', 'Emirates NBD Skywards Infinite Credit Card', 25000, 'Travel'],
  ['ENBD', 'Emirates NBD dnata World Credit Card', 25000, 'Travel'],
  ['ENBD', 'Emirates NBD Etihad Guest Signature Card', 12000, 'Travel'],
  ['ENBD', 'Emirates NBD Etihad Guest Gold Card', 8000, 'Travel'],
  ['ENBD', 'Emirates NBD Marriott Bonvoy World Mastercard', 15000, 'Travel'],
  ['ENBD', 'Emirates NBD Visa Flexi Credit Card', 12000, 'Regular'],
  ['ENBD', 'Emirates NBD noon One Visa Credit Card', 5000, 'E-Commerce'],
  ['ENBD', 'Liv. Cashback+ Credit Card (ENBD)', 5000, 'Rewards & Lifestyle'],
  ['ENBD', 'Emirates NBD Diners Club & Mastercard (Golf)', 15000, 'Legacy'],

  ['EIB', 'Emirates Islamic Skywards Signature Credit Card', 12000, 'Travel'],
  ['EIB', 'Emirates Islamic Skywards Gold Credit Card', 8000, 'Travel'],
  ['EIB', 'Emirates Islamic Skywards Black Credit Card', 35000, 'Travel'],
  ['EIB', 'Emirates Islamic Etihad Guest Platinum Credit Card', 8000, 'Travel'],
  ['EIB', 'Emirates Islamic Etihad Guest Saqer Credit Card', 12000, 'Travel'],
  ['EIB', 'Emirates Islamic Etihad Guest Ameera Card', 12000, 'Travel'],
  ['EIB', 'Emirates Islamic CashBack Plus Credit Card', 5000, 'Rewards & Lifestyle'],
  ['EIB', 'Emirates Islamic Emarati Platinum Credit Card', 5000, 'Regular'],
  ['EIB', 'Emirates Islamic Flex Mastercard Credit Card', 5000, 'Regular'],

  ['CBD', 'CBD Super Saver Visa Credit Card', 5000, 'Rewards & Lifestyle'],
  ['CBD', 'CBD Smiles Visa Platinum Credit Card', 8000, 'Rewards & Lifestyle'],
  ['CBD', 'CBD Smiles Visa Signature Credit Card', 15000, 'Rewards & Lifestyle'],
  ['CBD', 'CBD Visa Infinite Credit Card', 20000, 'Legacy'],
  ['CBD', 'CBD Visa Classic Credit Card', 5000, 'Regular'],

  ['FAB', 'FAB Standard Credit Card', 5000, 'Regular'],
  ['FAB', 'FAB Cashback Credit Card', 5000, 'Rewards & Lifestyle'],
  ['FAB', 'FAB Islamic Cashback Credit Card', 5000, 'Rewards & Lifestyle'],
  ['FAB', 'FAB GEMS Titanium Credit Card', 5000, 'Rewards & Lifestyle'],
  ['FAB', 'FAB ADNOC Cashback Credit Card', 5000, 'Rewards & Lifestyle'],
  ['FAB', 'FAB Z Card', 5000, 'E-Commerce'],
  ['FAB', 'FAB Rewards Platinum Credit Card', 8000, 'Rewards & Lifestyle'],
  ['FAB', 'FAB Rewards Signature Credit Card', 12000, 'Rewards & Lifestyle'],
  ['FAB', 'FAB Rewards Elite Infinite Credit Card', 20000, 'Legacy'],
  ['FAB', 'FAB Travel Credit Card', 10000, 'Travel'],
  ['FAB', 'FAB Etihad Guest Platinum Credit Card', 8000, 'Travel'],
  ['FAB', 'FAB Etihad Guest Signature Credit Card', 12000, 'Travel'],
  ['FAB', 'FAB Etihad Guest Infinite Credit Card', 30000, 'Travel'],
  ['FAB', 'FAB Blue Infinite Visa Card (Al Futtaim)', 10000, 'Rewards & Lifestyle'],
  ['FAB', 'FAB World Elite Mastercard', 50000, 'Legacy'],

  ['RAK', 'RAKBANK Red Mastercard Credit Card', 5000, 'Regular'],
  ['RAK', 'RAKBANK Classic Mastercard Credit Card', 5000, 'Regular'],
  ['RAK', 'RAKBANK Gold Mastercard Credit Card', 8000, 'Rewards & Lifestyle'],
  ['RAK', 'RAKBANK Titanium Mastercard Credit Card', 5000, 'Regular'],
  ['RAK', 'RAKBANK Platinum Mastercard Credit Card', 10000, 'Rewards & Lifestyle'],
  ['RAK', 'RAKBANK Emirates Skywards Gold Credit Card', 8000, 'Travel'],
  ['RAK', 'RAKBANK Emirates Skywards Platinum Credit Card', 12000, 'Travel'],
  ['RAK', 'RAKBANK FC Barcelona Platinum Credit Card', 8000, 'Rewards & Lifestyle'],
  ['RAK', 'RAKBANK Elevate World Elite Mastercard', 25000, 'Legacy'],

  ['DIB', 'DIB Cashback Plus Visa Credit Card', 5000, 'Rewards & Lifestyle'],
  ['DIB', 'DIB Wala\'a Rewards Visa Infinite Credit Card', 10000, 'Legacy'],
  ['DIB', 'DIB Skywards Covered Card', 8000, 'Travel'],
  ['DIB', 'DIB Consumer Platinum Covered Card', 5000, 'Regular'],
  ['DIB', 'DIB Consumer Reward Covered Card', 5000, 'Rewards & Lifestyle'],

  ['SIB', 'SIB Classic Visa Credit Card', 5000, 'Regular'],
  ['SIB', 'SIB Gold Mastercard Covered Card', 8000, 'Rewards & Lifestyle'],
  ['SIB', 'SIB Platinum Mastercard Covered Card', 10000, 'Legacy'],
  ['SIB', 'SIB World Mastercard Covered Card (Smiles)', 15000, 'Travel'],

  ['Deem', 'Deem Titanium Cash Up Mastercard', 5000, 'Regular'],
  ['Deem', 'Deem Platinum Cash Up Mastercard', 10000, 'Rewards & Lifestyle'],
  ['Deem', 'Deem World Cash Up Mastercard', 25000, 'Legacy'],
  ['Deem', 'Deem Titanium Miles Up Mastercard', 5000, 'Travel'],
  ['Deem', 'Deem Platinum Miles Up Mastercard', 10000, 'Travel'],
  ['Deem', 'Deem World Miles Up Mastercard', 25000, 'Travel'],

  ['Ajman', 'Ajman Bank ULTRACASH Mastercard Touch Card', 10000, 'Rewards & Lifestyle'],
  ['Ajman', 'Ajman Bank Classic Visa Credit Card', 5000, 'Regular'],
  ['Ajman', 'Ajman Bank Gold Visa Credit Card', 8000, 'Rewards & Lifestyle'],
  ['Ajman', 'Ajman Bank Platinum Visa Credit Card', 10000, 'Legacy'],

  ['Mashreq', 'Mashreq Cashback Credit Card', 5000, 'Rewards & Lifestyle'],
  ['Mashreq', 'Mashreq noon Credit Card', 5000, 'E-Commerce'],
  ['Mashreq', 'Mashreq Solitaire Credit Card', 5000, 'Rewards & Lifestyle'],
  ['Mashreq', 'Mashreq Platinum Elite MasterCard', 6000, 'Regular'],
  ['Mashreq', 'Mashreq Platinum Elite Visa Card', 6000, 'Regular'],
  ['Mashreq', 'Mashreq Platinum Elite Portraits Card', 6000, 'Regular'],
  ['Mashreq', 'Mashreq Vantage World Elite Mastercard', 25000, 'Legacy'],
  ['Mashreq', 'Mashreq IO Credit Card', 5000, 'Rewards & Lifestyle'],
  ['Mashreq', 'Mashreq Novo Credit Card', 10000, 'Travel'],

  ['Aafaq', 'Aafaq Classic Visa Covered Card', 5000, 'Regular'],
  ['Aafaq', 'Aafaq Gold Visa Covered Card', 8000, 'Rewards & Lifestyle'],
  ['Aafaq', 'Aafaq Platinum Visa Covered Card', 10000, 'Legacy'],

  ['Invest', 'Invest Bank Classic Visa Credit Card', 5000, 'Regular'],
  ['Invest', 'Invest Bank Gold Visa Credit Card', 8000, 'Rewards & Lifestyle'],
  ['Invest', 'Invest Bank Platinum Visa Credit Card', 10000, 'Legacy'],

  ['UAB', 'UAB Classic Visa Credit Card', 5000, 'Regular'],
  ['UAB', 'UAB Gold Mastercard Credit Card', 8000, 'Rewards & Lifestyle'],
  ['UAB', 'UAB Platinum Visa Credit Card', 10000, 'Legacy'],

  ['Mawarid', 'Mawarid Classic Covered Card', 5000, 'Regular'],
  ['Mawarid', 'Mawarid Gold Covered Card', 8000, 'Rewards & Lifestyle'],
  ['Mawarid', 'Mawarid Platinum Covered Card', 10000, 'Legacy'],

  ['Arab', 'Arab Bank Classic Visa Credit Card', 5000, 'Regular'],
  ['Arab', 'Arab Bank Gold Visa Credit Card', 8000, 'Rewards & Lifestyle'],
  ['Arab', 'Arab Bank Visa Platinum Credit Card', 10000, 'Legacy'],

  ['Wio', 'Wio Credit Card', 5000, 'E-Commerce'],
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Upsert banks
  const bankMap = {};
  for (const b of BANKS) {
    const bank = await Bank.findOneAndUpdate(
      { code: b.code },
      { $setOnInsert: { name: b.name, code: b.code } },
      { upsert: true, new: true }
    );
    bankMap[b.code] = bank._id;
    console.log(`Bank: ${b.name} (${b.code})`);
  }

  // Upsert card products — create new, update commissions on existing
  let created = 0;
  let updated = 0;
  for (const [bankCode, cardName, minSalary, typeLabel] of CARDS) {
    const cardType = TYPE_MAP[typeLabel] || 'regular';
    const { receivable, payable } = COMMISSION_MAP[cardType] || COMMISSION_MAP.default;
    const bracket = { minimumSalary: minSalary, receivable, payable };

    const existing = await CardProduct.findOne({ name: cardName });
    if (existing) {
      existing.commissionBrackets = [bracket];
      await existing.save();
      updated++;
      console.log(`  Updated: ${cardName} → R:${receivable} / P:${payable}`);
    } else {
      await CardProduct.create({
        name: cardName,
        cardType,
        bank: bankMap[bankCode],
        commissionBrackets: [bracket],
        isActive: true,
      });
      created++;
      console.log(`  Created: ${cardName} → R:${receivable} / P:${payable}`);
    }
  }

  console.log(`\nDone. Created: ${created}, Updated: ${updated}`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
