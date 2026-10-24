/* eslint-disable no-console */
// One-off, idempotent: give every user without a coinBalance field an explicit 0.
// Safe to re-run and safe while the app is live: the $exists:false filter never
// touches a balance that already exists (including one a concurrent $inc just created).
// Run on the server from backend/ (needs MONGO_URI in .env):
//   node scripts/backfillCoinBalance.js --dry-run
//   node scripts/backfillCoinBalance.js
const FILTER = { coinBalance: { $exists: false } };
const UPDATE = { $set: { coinBalance: 0 } };

const USAGE = `Usage:
  node scripts/backfillCoinBalance.js [--dry-run]

  --dry-run   count users missing coinBalance, write nothing`;

function parseArgs(argv) {
  const out = { dryRun: false, help: false, errors: [] };
  for (const arg of argv) {
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else out.errors.push(`Unknown argument: ${arg}`);
  }
  return out;
}

// All DB access goes through the injected model so it can be tested with fakes.
async function runBackfill({ User, dryRun, log = console.log }) {
  if (dryRun) {
    const missing = await User.countDocuments(FILTER);
    log(`[DRY RUN] ${missing} user(s) without coinBalance would be set to 0`);
    return { missing, updated: 0 };
  }
  // timestamps:false: a data backfill, not a user edit, so updatedAt is left alone.
  const r = await User.updateMany(FILTER, UPDATE, { timestamps: false });
  log(`Set coinBalance 0 on ${r.modifiedCount} user(s) (matched ${r.matchedCount})`);
  return { missing: r.matchedCount, updated: r.modifiedCount };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(USAGE); return 0; }
  if (args.errors.length) { console.error(args.errors.join('\n') + '\n\n' + USAGE); return 1; }
  require('dotenv').config();
  if (!process.env.MONGO_URI) { console.error('MONGO_URI is not set (check .env)'); return 1; }
  const mongoose = require('mongoose');
  let code = 0;
  try {
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false });
    await runBackfill({ User: require('../models/User'), dryRun: args.dryRun });
  } catch (e) {
    console.error('Error:', e.message);
    code = 1;
  } finally {
    await mongoose.disconnect();
  }
  return code;
}

module.exports = { parseArgs, runBackfill, FILTER, UPDATE };

if (require.main === module) main().then((c) => process.exit(c));
