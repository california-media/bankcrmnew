require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Bank = require('../models/Bank');
const CardProduct = require('../models/CardProduct');
const User = require('../models/User');

const NEW_CARDS = [
  { name: 'EIB Etihad Guest Platinum Credit Card',   minSalary: 5000,  cardType: 'travel' },
  { name: 'Amazon Platinum Credit Card',             minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'Emarati Credit Card',                     minSalary: 12000, cardType: 'rewards_lifestyle' },
  { name: 'Etihad Guest Ameera Credit Card',         minSalary: 12000, cardType: 'travel' },
  { name: 'Flex Elite Credit Card',                  minSalary: 15000, cardType: 'rewards_lifestyle' },
  { name: 'Amazon World Credit Card',                minSalary: 15000, cardType: 'rewards_lifestyle' },
  { name: 'Etihad Guest Premium Credit Card',        minSalary: 20000, cardType: 'travel' },
  { name: 'EIB Cashback Credit Card',                minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'RTA Credit Card',                         minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'Etihad Guest Saqer Credit Card',          minSalary: 12000, cardType: 'travel' },
  { name: 'Switch Cashback Credit Card',             minSalary: 10000, cardType: 'rewards_lifestyle' },
  { name: 'Cashback Plus Credit Card',               minSalary: 12000, cardType: 'rewards_lifestyle' },
  { name: 'EIB Skywards Infinite Credit Card',       minSalary: 25000, cardType: 'travel' },
  { name: 'EIB Skywards Black Credit Card',          minSalary: 35000, cardType: 'travel' },
  { name: 'EIB Skywards Signature Credit Card',      minSalary: 12000, cardType: 'travel' },
  { name: 'Flex Credit Card',                        minSalary: 5000,  cardType: 'rewards_lifestyle' },
];

const COMMISSION_MAP = {
  regular:           { receivable: 700,  payable: 600 },
  rewards_lifestyle: { receivable: 700,  payable: 600 },
  travel:            { receivable: 700,  payable: 600 },
  legacy:            { receivable: 1000, payable: 800 },
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');

  const bank = await Bank.findOneAndUpdate(
    { code: 'EIB' },
    { $setOnInsert: { name: 'Emirates Islamic Bank', code: 'EIB' } },
    { upsert: true, new: true }
  );
  console.log(`Bank: ${bank.name}`);

  const agency = await User.findOne({ email: 'credora@gmail.com' });
  if (!agency) { console.error('credora@gmail.com not found'); process.exit(1); }
  console.log(`Agency: ${agency.name || agency.email}`);

  for (const c of NEW_CARDS) {
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

  console.log('Done.');
  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
