require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Bank = require('../models/Bank');
const CardProduct = require('../models/CardProduct');
const User = require('../models/User');

const NEW_CARDS = [
  { name: 'dnata Platinum Credit Card',                          minSalary: 5000,  cardType: 'travel' },
  { name: 'Marriott Bonvoy® World Mastercard®',                  minSalary: 12000, cardType: 'travel' },
  { name: 'Etihad Guest Visa Inspire',                           minSalary: 12000, cardType: 'travel' },
  { name: 'Skywards Signature Credit Card',                      minSalary: 12000, cardType: 'travel' },
  { name: 'dnata World Credit Card',                             minSalary: 20000, cardType: 'travel' },
  { name: 'Voyager World Elite Credit Card',                     minSalary: 25000, cardType: 'travel' },
  { name: 'Voyager World Credit Card',                           minSalary: 25000, cardType: 'travel' },
  { name: 'Marriott Bonvoy® World Elite Mastercard®',            minSalary: 25000, cardType: 'travel' },
  { name: 'Etihad Guest Visa Elevate',                           minSalary: 30000, cardType: 'travel' },
  { name: 'Skywards Infinite Credit Card',                       minSalary: 30000, cardType: 'travel' },
  { name: 'SHARE Visa Platinum Credit Card',                     minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'Darna Select Visa Credit Card',                       minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'U by Emaar Family Credit Card',                       minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'LuLu 247 Titanium Credit Card',                       minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'ENBD Mastercard Titanium Credit Card',                minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'Go4it Gold Credit Card',                              minSalary: 5000,  cardType: 'rewards_lifestyle' },
  { name: 'LuLu 247 Platinum Credit Card',                       minSalary: 12000, cardType: 'rewards_lifestyle' },
  { name: 'SHARE Visa Signature Credit Card',                    minSalary: 12000, cardType: 'rewards_lifestyle' },
  { name: 'Darna Visa Signature Credit Card',                    minSalary: 12000, cardType: 'rewards_lifestyle' },
  { name: 'Go4it Platinum Credit Card',                          minSalary: 12000, cardType: 'rewards_lifestyle' },
  { name: 'Duo Credit Card',                                     minSalary: 12000, cardType: 'rewards_lifestyle' },
  { name: 'U By Emaar Signature Credit Card',                    minSalary: 12000, cardType: 'rewards_lifestyle' },
  { name: 'ENBD Mastercard Platinum Credit Card',                minSalary: 12000, cardType: 'rewards_lifestyle' },
  { name: 'Visa Flexi Credit Card',                              minSalary: 12000, cardType: 'rewards_lifestyle' },
  { name: 'SHARE Visa Infinite Credit Card',                     minSalary: 30000, cardType: 'rewards_lifestyle' },
  { name: 'ENBD Visa Infinite Credit Card',                      minSalary: 30000, cardType: 'rewards_lifestyle' },
  { name: 'Darna Visa Infinite Credit Card',                     minSalary: 30000, cardType: 'rewards_lifestyle' },
  { name: 'U by Emaar Infinite Credit Card',                     minSalary: 30000, cardType: 'rewards_lifestyle' },
  { name: 'U by Emaar Visa Infinite Emirati Credit Card',        minSalary: 30000, cardType: 'rewards_lifestyle' },
  { name: 'Priority Banking Visa Infinite Credit Card',          minSalary: 50000, cardType: 'rewards_lifestyle' },
  { name: 'Webshopper Credit Card',                              minSalary: 5000,  cardType: 'legacy' },
  { name: 'Manchester United Credit Card',                       minSalary: 5000,  cardType: 'legacy' },
  { name: 'Diners Club Credit Card',                             minSalary: 12000, cardType: 'legacy' },
  { name: 'ENBD Visa Platinum Credit Card',                      minSalary: 12000, cardType: 'legacy' },
];

const COMMISSION_MAP = {
  regular:           { receivable: 700,  payable: 600 },
  rewards_lifestyle: { receivable: 700,  payable: 600 },
  travel:            { receivable: 700,  payable: 600 },
  ecommerce:         { receivable: 700,  payable: 600 },
  legacy:            { receivable: 1000, payable: 800 },
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');

  const bank = await Bank.findOneAndUpdate(
    { code: 'ENBD' },
    { $setOnInsert: { name: 'Emirates NBD', code: 'ENBD' } },
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
