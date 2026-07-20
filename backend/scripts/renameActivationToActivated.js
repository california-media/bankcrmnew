require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const EmployeeStatus = require('../models/EmployeeStatus');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await EmployeeStatus.updateMany(
    { label: /^activation$/i, statusType: 'lead_label' },
    { $set: { label: 'Activated' } },
  );
  console.log(`Updated ${result.modifiedCount} record(s).`);
  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => { console.error(err); process.exit(1); });
