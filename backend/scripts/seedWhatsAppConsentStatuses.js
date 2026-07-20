require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const EmployeeStatus = require('../models/EmployeeStatus');

const DEFAULTS = [
  { label: 'Consent Sent',      color: 'blue',  order: 1 },
  { label: 'Consent Confirmed', color: 'green', order: 2 },
  { label: 'Consent Rejected',  color: 'red',   order: 3 },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  for (const d of DEFAULTS) {
    const exists = await EmployeeStatus.findOne({ label: d.label, statusType: 'whatsapp_consent' });
    if (!exists) {
      await EmployeeStatus.create({ ...d, statusType: 'whatsapp_consent', isActive: true });
      console.log(`Created: ${d.label}`);
    } else {
      console.log(`Exists:  ${d.label}`);
    }
  }
  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => { console.error(err); process.exit(1); });
