require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const CardProduct = require('../models/CardProduct');
const LoanProduct = require('../models/LoanProduct');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const cardResult = await CardProduct.updateMany(
    {},
    { $set: { redirectUrl: 'https://mysilah.ae/', redirectActive: true } }
  );
  console.log(`Cards updated: ${cardResult.modifiedCount}`);

  const loanResult = await LoanProduct.updateMany(
    {},
    { $set: { redirectUrl: 'https://mysilah.ae/', redirectActive: true } }
  );
  console.log(`Loans updated: ${loanResult.modifiedCount}`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => { console.error(err); process.exit(1); });
