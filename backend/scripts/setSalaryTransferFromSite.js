// One-time: move the website's hardcoded "no salary transfer" card list
// (credit-cards-in-uae.html NO_SALARY_TRANSFER_IDS) into CardProduct.salaryTransfer.
// Only fills cards whose salaryTransfer is still empty. Dry run unless --apply.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const CardProduct = require('../models/CardProduct');

const NO_SALARY_TRANSFER_IDS = [
  '6a5a09c2f17a2cee4eac7345', '6a5a09cdf17a2cee4eac736a', '6a5a09cdf17a2cee4eac7369', '6a5a09ccf17a2cee4eac7368',
  '6a5a09c5f17a2cee4eac7350', '6a5a09cdf17a2cee4eac736b', '6a5a09ccf17a2cee4eac7367', '6a5a09c6f17a2cee4eac7353',
  '6a5a09cbf17a2cee4eac7364', '6a5a09c6f17a2cee4eac7352', '6a5a09c6f17a2cee4eac7354', '6a5a09c6f17a2cee4eac7351',
  '6a5a09cbf17a2cee4eac7362', '6a5a09cbf17a2cee4eac7363', '6a6769b46f553c3ce2a3aa11', '6a6769b56f553c3ce2a3aa13',
  '6a6769b36f553c3ce2a3aa10', '6a6769b16f553c3ce2a3aa0f', '6a6769b66f553c3ce2a3aa14', '6a6769b56f553c3ce2a3aa12',
  '6a5a09c9f17a2cee4eac735c', '6a5a09c9f17a2cee4eac735e', '6a5a09d1f17a2cee4eac7378', '6ad5e7f08a2ffe49fdfbc408',
  '6a5a09bff17a2cee4eac733d', '6ad5e7f18a2ffe49fdfbc409', '6ad5e7f18a2ffe49fdfbc40a', '6ad5e7f18a2ffe49fdfbc40b',
  '6a5a09c3f17a2cee4eac7349', '6a5a09d1f17a2cee4eac7377', '6a5a09c2f17a2cee4eac7348', '6a5a09bef17a2cee4eac7339',
  '6a5a09c0f17a2cee4eac733e', '6a5a09bef17a2cee4eac7337', '6a5a09c1f17a2cee4eac7343', '6a5a09bef17a2cee4eac7338',
  '6a5a09bdf17a2cee4eac7335', '6a5a09c1f17a2cee4eac7344', '6a5a09c2f17a2cee4eac7347', '6a5a09bff17a2cee4eac733b',
  '6a5a09bff17a2cee4eac733a', '6a5a09bff17a2cee4eac733c',
];

async function run() {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGO_URI);
  const filter = { _id: { $in: NO_SALARY_TRANSFER_IDS }, salaryTransfer: { $in: ['', null] } };
  const cards = await CardProduct.find(filter).select('name').lean();
  console.log(`${NO_SALARY_TRANSFER_IDS.length} ids, ${cards.length} cards to set "not_required"`);
  cards.forEach((c) => console.log(' -', c.name));
  if (apply) {
    const res = await CardProduct.updateMany(filter, { $set: { salaryTransfer: 'not_required' } });
    console.log(`Updated ${res.modifiedCount}`);
  } else {
    console.log('Dry run — pass --apply to write.');
  }
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
