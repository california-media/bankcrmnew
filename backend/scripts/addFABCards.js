require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Bank = require('../models/Bank');
const CardProduct = require('../models/CardProduct');
const User = require('../models/User');

const FAB_CARDS = [
  { name: 'FAB Cashback Credit Card',                          minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'FAB Islamic Cashback Credit Card',                  minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'Blue FAB Islamic Credit Card',                      minSalary: 15000, cardType: 'rewards_lifestyle' },
  { name: 'FAB Emirati Islamic Credit Card',                   minSalary: 15000, cardType: 'rewards_lifestyle' },
  { name: 'FAB Etihad Guest Platinum Islamic Credit Card',     minSalary: 8000,  cardType: 'travel' },
  { name: 'FAB Etihad Guest Signature Islamic Credit Card',    minSalary: 15000, cardType: 'travel' },
  { name: 'FAB Etihad Guest Infinite Islamic Credit Card',     minSalary: 30000, cardType: 'travel' },
  { name: 'FAB GEMS World Credit Card',                        minSalary: 8000,  cardType: 'rewards_lifestyle' },
  { name: 'FAB ADNOC Cashback Credit Card',                    minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'FAB MANCHESTER CITY Credit Card',                   minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'FAB Z Card',                                        minSalary: 5000,  cardType: 'ecommerce' },
  { name: 'FAB SHARE Platinum Credit Card',                    minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'FAB SHARE Signature Credit Card',                   minSalary: 10000, cardType: 'rewards_lifestyle' },
  { name: 'FAB SHARE Infinite Credit Card',                    minSalary: 25000, cardType: 'rewards_lifestyle' },
  { name: 'FAB Travel Credit Card',                            minSalary: 20000, cardType: 'travel' },
  { name: 'FAB Etihad Guest Platinum Credit Card',             minSalary: 8000,  cardType: 'travel' },
  { name: 'FAB Etihad Guest Signature Credit Card',            minSalary: 15000, cardType: 'travel' },
  { name: 'FAB Etihad Guest Infinite Credit Card',             minSalary: 30000, cardType: 'travel' },
  { name: 'FAB Blue Platinum Visa Card (Al Futtaim)',          minSalary: 8000,  cardType: 'rewards_lifestyle' },
  { name: 'FAB Blue Signature Visa Card (Al Futtaim)',         minSalary: 15000, cardType: 'rewards_lifestyle' },
  { name: 'FAB Blue Infinite Visa Card (Al Futtaim)',          minSalary: 40000, cardType: 'rewards_lifestyle' },
  { name: 'FAB Rewards Active Credit Card',                    minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'FAB Rewards Indulge Card',                          minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'du Credit Card',                                    minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'FAB World Elite Mastercard',                        minSalary: 40000, cardType: 'legacy' },
];

const DF_CARDS = [
  { name: 'Dubai First Cashback Credit Card', minSalary: 5000, cardType: 'rewards_lifestyle' },
  { name: 'Dubai First Low-Rate Credit Card', minSalary: 5000, cardType: 'rewards_lifestyle' },
  { name: 'SlicePay',                         minSalary: 5000, cardType: 'rewards_lifestyle' },
];

const COMMISSION_MAP = {
  regular:           { receivable: 700,  payable: 600 },
  rewards_lifestyle: { receivable: 700,  payable: 600 },
  travel:            { receivable: 700,  payable: 600 },
  ecommerce:         { receivable: 700,  payable: 600 },
  legacy:            { receivable: 1000, payable: 800 },
};

async function upsertCards(cards, bank, agency) {
  for (const c of cards) {
    const { receivable, payable } = COMMISSION_MAP[c.cardType];
    const bracket = { minimumSalary: c.minSalary, receivable, payable, feeType: 'free' };

    const existing = await CardProduct.findOne({ name: c.name });
    if (existing) {
      existing.agency = agency._id;
      existing.commissionBrackets = [bracket];
      await existing.save();
      console.log(`Updated: ${c.name}`);
    } else {
      await CardProduct.create({
        name: c.name,
        cardType: c.cardType,
        bank: bank._id,
        agency: agency._id,
        commissionBrackets: [bracket],
        isActive: true,
      });
      console.log(`Created: ${c.name}`);
    }
  }
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');

  const agency = await User.findOne({ email: 'credora@gmail.com' });
  if (!agency) { console.error('credora@gmail.com not found'); process.exit(1); }
  console.log(`Agency: ${agency.name || agency.email}`);

  const fabBank = await Bank.findOneAndUpdate(
    { code: 'FAB' },
    { $setOnInsert: { name: 'First Abu Dhabi Bank', code: 'FAB' } },
    { upsert: true, new: true }
  );
  console.log(`\nBank: ${fabBank.name}`);
  await upsertCards(FAB_CARDS, fabBank, agency);

  const dfBank = await Bank.findOneAndUpdate(
    { code: 'DF' },
    { $setOnInsert: { name: 'Dubai First', code: 'DF' } },
    { upsert: true, new: true }
  );
  console.log(`\nBank: ${dfBank.name}`);
  await upsertCards(DF_CARDS, dfBank, agency);

  console.log('\nDone.');
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
