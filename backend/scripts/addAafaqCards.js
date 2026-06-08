require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Bank = require('../models/Bank');
const CardProduct = require('../models/CardProduct');
const User = require('../models/User');

const NEW_CARDS = [
  { name: 'Afaq World Credit Card',        minSalary: 20000, cardType: 'legacy' },
  { name: 'Aafaq Platinum Credit Card',    minSalary: 8000,  cardType: 'rewards_lifestyle' },
  { name: 'Aafaq Titanium Credit Card',    minSalary: 5000,  cardType: 'regular' },
];

const COMMISSION_MAP = {
  regular:           { receivable: 700,  payable: 600 },
  rewards_lifestyle: { receivable: 700,  payable: 600 },
  legacy:            { receivable: 1000, payable: 800 },
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');

  const bank = await Bank.findOneAndUpdate(
    { code: 'Aafaq' },
    { $setOnInsert: { name: 'Aafaq Islamic Finance', code: 'Aafaq' } },
    { upsert: true, new: true }
  );
  console.log(`Bank: ${bank.name}`);

  const agency = await User.findOne({ email: 'agency2@gmail.com' });
  if (!agency) { console.error('agency2@gmail.com not found'); process.exit(1); }
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
