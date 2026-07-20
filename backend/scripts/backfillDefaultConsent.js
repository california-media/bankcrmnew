/**
 * One-shot: assign default whatsapp_consent status to all submitted/active leads
 * that currently have no consentStatus.
 * Run: node backend/scripts/backfillDefaultConsent.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const EmployeeStatus = require('../models/EmployeeStatus');
const Lead = require('../models/Lead');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  // Find default: explicit isDefault first, then lowest order
  let def = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', isDefault: true, isActive: true });
  if (!def) {
    def = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', isActive: true }).sort({ order: 1, createdAt: 1 });
  }
  if (!def) {
    console.log('No active whatsapp_consent status found. Exiting.');
    process.exit(0);
  }
  console.log(`Using default consent status: "${def.label}" (${def._id})`);

  const result = await Lead.updateMany(
    { consentStatus: { $exists: false }, status: { $nin: ['draft'] } },
    { consentStatus: def._id }
  );
  console.log(`Updated ${result.modifiedCount} leads.`);
  await mongoose.disconnect();
})();
