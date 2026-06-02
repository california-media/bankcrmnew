/**
 * Run once: node backend/scripts/seedLoanStatuses.js
 * Seeds the 8 default loan stage statuses.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const EmployeeStatus = require('../models/EmployeeStatus');

const LOAN_STATUSES = [
  { label: 'Account Open',   color: 'blue',    order: 1 },
  { label: 'Liability Letter', color: 'cyan',   order: 2 },
  { label: 'MC Submitted',   color: 'gold',    order: 3 },
  { label: 'LL Received',    color: 'green',   order: 4 },
  { label: 'CL Pending',     color: 'orange',  order: 5 },
  { label: 'CL Received',    color: 'green',   order: 6 },
  { label: 'STL Pending',    color: 'volcano', order: 7 },
  { label: 'STL Received',   color: 'purple',  order: 8 },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  for (const s of LOAN_STATUSES) {
    const exists = await EmployeeStatus.findOne({ label: s.label, statusType: 'loan_status' });
    if (!exists) {
      await EmployeeStatus.create({ ...s, statusType: 'loan_status', isActive: true, isFixed: true });
      console.log(`Created: ${s.label}`);
    } else {
      console.log(`Exists:  ${s.label}`);
    }
  }
  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((e) => { console.error(e); process.exit(1); });
