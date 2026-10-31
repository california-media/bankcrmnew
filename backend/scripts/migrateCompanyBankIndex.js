// Companies used to be unique by name. They are now unique by name + bank, so
// the same company can be listed under several banks. Drops the old unique
// name index, fills bankKey on older rows and builds the new index.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Company = require('../models/Company');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const indexes = await Company.collection.indexes();
  if (indexes.some((i) => i.name === 'nameKey_1')) {
    await Company.collection.dropIndex('nameKey_1');
    console.log('Dropped nameKey_1.');
  }
  const filled = await Company.collection.updateMany({ bankKey: { $exists: false } }, [
    { $set: { bankKey: { $toLower: { $ifNull: ['$bankName', ''] } } } },
  ]);
  console.log(`Filled bankKey on ${filled.modifiedCount} row(s).`);
  await Company.syncIndexes();
  console.log('Indexes:', (await Company.collection.indexes()).map((i) => i.name).join(', '));
  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => { console.error(err); process.exit(1); });
