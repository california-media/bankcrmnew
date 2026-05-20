/**
 * One-time script: assign an agency to all loan products that have none.
 * Run: node backend/scripts/fixLoanProductAgencies.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const User        = require('../models/User');
  const LoanProduct = require('../models/LoanProduct');

  // List all agencies
  const agencies = await User.find({ role: 'agency' }).select('name email').lean();
  if (!agencies.length) {
    console.error('No agencies found in DB. Create an agency first.');
    process.exit(1);
  }

  console.log('\nAvailable agencies:');
  agencies.forEach((a, i) => console.log(`  ${i}: ${a.name || a.email}  (${a._id})`));

  // Find loan products with no agency
  const unassigned = await LoanProduct.find({ agency: { $exists: false } })
    .select('name loanCategory bank')
    .lean();

  const nullAgency = await LoanProduct.find({ agency: null })
    .select('name loanCategory bank')
    .lean();

  const toFix = [...unassigned, ...nullAgency];

  if (!toFix.length) {
    console.log('\nAll loan products already have an agency assigned. Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  console.log(`\nLoan products without agency (${toFix.length}):`);
  toFix.forEach((p) => console.log(`  - ${p.name} [${p.loanCategory}]  (${p._id})`));

  // If only 1 agency, auto-assign. Otherwise assign to first and log.
  const target = agencies[0];
  console.log(`\nAssigning all to: ${target.name || target.email} (${target._id})`);

  const ids = toFix.map((p) => p._id);
  const result = await LoanProduct.updateMany(
    { _id: { $in: ids } },
    { agency: target._id }
  );

  console.log(`\nDone. Updated ${result.modifiedCount} loan product(s).`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
