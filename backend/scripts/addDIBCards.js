require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Bank = require('../models/Bank');
const CardProduct = require('../models/CardProduct');
const User = require('../models/User');

const NEW_CARDS = [
  { name: 'DIB SHAMS Infinite Covered Card',                      minSalary: 0, cardType: 'travel' },
  { name: 'DIB SHAMS Signature Covered Card',                     minSalary: 0, cardType: 'travel' },
  { name: 'DIB SHAMS Platinum Covered Card',                      minSalary: 0, cardType: 'travel' },
  { name: 'The Emirates Skywards DIB Infinite Covered Card',      minSalary: 0, cardType: 'travel' },
  { name: 'The Emirates Skywards DIB Signature Covered Card',     minSalary: 0, cardType: 'travel' },
  { name: 'The Emirates Skywards DIB Platinum Covered Card',      minSalary: 0, cardType: 'travel' },
  { name: 'Consumer Cashback Platinum Card',                      minSalary: 0, cardType: 'rewards_lifestyle' },
  { name: 'Consumer Cashback Reward Card',                        minSalary: 0, cardType: 'rewards_lifestyle' },
  { name: 'Prime Infinite Card',                                  minSalary: 0, cardType: 'legacy' },
  { name: 'Prime Signature Card',                                 minSalary: 0, cardType: 'rewards_lifestyle' },
  { name: 'Prime Platinum Card',                                  minSalary: 0, cardType: 'travel' },
  { name: 'Prime Gold Card',                                      minSalary: 0, cardType: 'rewards_lifestyle' },
  { name: 'Prime Classic Card',                                   minSalary: 0, cardType: 'rewards_lifestyle' },
  { name: 'Al Islami Platinum Charge Card',                       minSalary: 0, cardType: 'rewards_lifestyle' },
  { name: 'Al Islami Gold Charge Card',                           minSalary: 0, cardType: 'rewards_lifestyle' },
  { name: 'Al Islami Classic Charge Card',                        minSalary: 0, cardType: 'rewards_lifestyle' },
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
    { code: 'DIB' },
    { $setOnInsert: { name: 'Dubai Islamic Bank', code: 'DIB' } },
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
