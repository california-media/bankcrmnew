/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');

/**
 * Drops the non-user collections so the schema/data lines up with the current
 * code. Keeps `users` (admin, agencies, agents). Run once after pulling the
 * per-agency banks/rules refactor:
 *
 *   node clean.js
 */
const TARGETS = ['banks', 'leads', 'commissionrules', 'volumebonus', 'volumebonuses'];

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const existing = (await mongoose.connection.db.listCollections().toArray()).map((c) => c.name);

    for (const name of TARGETS) {
      if (existing.includes(name)) {
        await mongoose.connection.db.dropCollection(name);
        console.log(`dropped: ${name}`);
      } else {
        console.log(`skipped (not found): ${name}`);
      }
    }
    console.log('done.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
