require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Bank = require('../models/Bank');
const CardProduct = require('../models/CardProduct');
const User = require('../models/User');

const NEW_CARDS = [
  { name: 'Citi Simplicity',    minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'Citi Cash Back',     minSalary: 8000,  cardType: 'rewards_lifestyle' },
  { name: 'Citi Ready Credit',  minSalary: 8000,  cardType: 'regular' },
  { name: 'Citi Premier',       minSalary: 15000, cardType: 'travel' },
  { name: 'Citi Rewards',       minSalary: 8000,  cardType: 'rewards_lifestyle' },
  { name: 'Citi Ultima',        minSalary: 36750, cardType: 'travel' },
  { name: 'Citi Prestige',      minSalary: 30000, cardType: 'travel' },
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
    { code: 'CITI' },
    { $setOnInsert: { name: 'Citi Bank', code: 'CITI' } },
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
