/* eslint-disable no-console */
// Test-data cleanup for the coins feature. Run on the server (needs MONGO_URI in .env).
//   node scripts/coinsTestCleanup.js --snapshot --users=a@x,b@y [--force]
//   node scripts/coinsTestCleanup.js --cleanup --users=a@x,b@y --voucher-prefix="[TEST]" [--dry-run]
const fs = require('fs');
const path = require('path');

const SNAPSHOT_PATH = path.join(__dirname, '.coins-settings-snapshot.json');
const SETTINGS_FIELDS = ['spinEnabled', 'spinSegments', 'inviteEnabled', 'inviteReward'];

const USAGE = `Usage:
  node scripts/coinsTestCleanup.js --snapshot --users=<emails> [--force]
  node scripts/coinsTestCleanup.js --cleanup --users=<emails> --voucher-prefix="[TEST]" [--dry-run]

  --users=a@x,b@y        comma-separated emails (case-insensitive)
  --voucher-prefix=...   voucher title prefix, at least 3 chars
  --dry-run              print what would change, write nothing
  --force                overwrite an existing snapshot`;

function parseArgs(argv) {
  const out = { mode: null, users: [], voucherPrefix: null, dryRun: false, force: false, help: false, errors: [] };
  for (const arg of argv) {
    if (arg === '--snapshot' || arg === '--cleanup') {
      const mode = arg.slice(2);
      if (out.mode && out.mode !== mode) out.errors.push('Choose only one of --snapshot / --cleanup');
      out.mode = mode;
    } else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--force') out.force = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg.startsWith('--users=')) {
      out.users = arg.slice('--users='.length).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    } else if (arg.startsWith('--voucher-prefix=')) out.voucherPrefix = arg.slice('--voucher-prefix='.length);
    else out.errors.push(`Unknown argument: ${arg}`);
  }
  return out;
}

function assertSafePrefix(prefix) {
  if (typeof prefix !== 'string' || prefix.length < 3) {
    throw new Error('--voucher-prefix must be at least 3 characters (e.g. "[TEST]")');
  }
  return prefix;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateArgs(args) {
  const errs = [...args.errors];
  if (!args.mode) errs.push('Specify --snapshot or --cleanup');
  if (args.mode && args.users.length === 0) errs.push('--users is required');
  if (args.mode === 'cleanup') {
    try { assertSafePrefix(args.voucherPrefix); } catch (e) { errs.push(e.message); }
  }
  return errs;
}

async function loadUsers(User, emails) {
  const users = await User.find({
    email: { $in: emails.map((e) => new RegExp(`^${escapeRegex(e)}$`, 'i')) },
  }).select('email coinBalance');
  const found = new Set(users.map((u) => u.email.toLowerCase()));
  const missing = emails.filter((e) => !found.has(e));
  if (missing.length) throw new Error(`Users not found: ${missing.join(', ')}`);
  return users;
}

async function snapshot(args) {
  const CoinSettings = require('../models/CoinSettings');
  const User = require('../models/User');
  if (fs.existsSync(SNAPSHOT_PATH) && !args.force) {
    throw new Error(`Snapshot already exists at ${SNAPSHOT_PATH}; use --force to overwrite`);
  }
  const users = await loadUsers(User, args.users);
  const s = await CoinSettings.getSingleton();
  const settings = {};
  for (const f of SETTINGS_FIELDS) settings[f] = JSON.parse(JSON.stringify(s[f]));
  const data = {
    takenAt: new Date().toISOString(),
    settings,
    users: users.map((u) => ({ email: u.email, _id: String(u._id), coinBalance: u.coinBalance || 0 })),
  };
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(data, null, 2));
  console.log(`Snapshot written to ${SNAPSHOT_PATH}`);
  console.log(JSON.stringify(data, null, 2));
}

async function cleanup(args) {
  const mongoose = require('mongoose');
  const CoinSettings = require('../models/CoinSettings');
  const CoinTransaction = require('../models/CoinTransaction');
  const SpinLog = require('../models/SpinLog');
  const Voucher = require('../models/Voucher');
  const VoucherCode = require('../models/VoucherCode');
  const Redemption = require('../models/Redemption');
  const User = require('../models/User');

  if (!fs.existsSync(SNAPSHOT_PATH)) throw new Error(`No snapshot at ${SNAPSHOT_PATH}; run --snapshot first`);
  const snap = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const takenAt = new Date(snap.takenAt);
  if (isNaN(takenAt)) throw new Error('Snapshot has invalid takenAt');
  const prefix = assertSafePrefix(args.voucherPrefix);
  const dry = args.dryRun;
  console.log(dry ? '[DRY RUN] nothing will be written' : 'Cleaning up');

  const users = await loadUsers(User, args.users);
  const snapByEmail = new Map(snap.users.map((u) => [u.email.toLowerCase(), u]));
  const noSnap = users.filter((u) => !snapByEmail.has(u.email.toLowerCase()));
  if (noSnap.length) throw new Error(`Users missing from snapshot: ${noSnap.map((u) => u.email).join(', ')}`);
  const userIds = users.map((u) => u._id);

  // Step 1: vouchers with the prefix
  const vouchers = await Voucher.find({ title: { $regex: `^${escapeRegex(prefix)}` } }).select('title logo');
  const voucherIds = vouchers.map((v) => v._id);
  console.log(`Step 1: ${vouchers.length} voucher(s) matching prefix ${JSON.stringify(prefix)}`);
  vouchers.forEach((v) => console.log(`  - ${v.title}${v.logo ? ` (S3 logo: ${v.logo} - delete manually)` : ''}`));
  if (voucherIds.length) {
    const redemptions = await Redemption.find({ voucher: { $in: voucherIds } }).select('_id');
    const redemptionIds = redemptions.map((r) => r._id);
    const txFilter = { redemption: { $in: redemptionIds } };
    let nTx, nRed, nCodes, nVouchers;
    if (dry) {
      nTx = redemptionIds.length ? await CoinTransaction.countDocuments(txFilter) : 0;
      nRed = redemptionIds.length;
      nCodes = await VoucherCode.countDocuments({ voucher: { $in: voucherIds } });
      nVouchers = voucherIds.length;
    } else {
      nTx = redemptionIds.length ? (await CoinTransaction.deleteMany(txFilter)).deletedCount : 0;
      nRed = (await Redemption.deleteMany({ voucher: { $in: voucherIds } })).deletedCount;
      nCodes = (await VoucherCode.deleteMany({ voucher: { $in: voucherIds } })).deletedCount;
      nVouchers = (await Voucher.deleteMany({ _id: { $in: voucherIds } })).deletedCount;
    }
    console.log(`  CoinTransactions (redemptions): ${nTx}, Redemptions: ${nRed}, VoucherCodes: ${nCodes}, Vouchers: ${nVouchers}`);
  }

  // Step 2: listed users' activity since snapshot
  const since = { user: { $in: userIds }, createdAt: { $gte: takenAt } };
  const nTx2 = dry ? await CoinTransaction.countDocuments(since) : (await CoinTransaction.deleteMany(since)).deletedCount;
  const nSpin = dry ? await SpinLog.countDocuments(since) : (await SpinLog.deleteMany(since)).deletedCount;
  console.log(`Step 2: CoinTransactions since ${snap.takenAt}: ${nTx2}, SpinLogs: ${nSpin}`);
  for (const u of users) {
    const target = snapByEmail.get(u.email.toLowerCase()).coinBalance;
    console.log(`  ${u.email}: coinBalance ${u.coinBalance || 0} -> ${target}`);
    if (!dry) await User.updateOne({ _id: u._id }, { $set: { coinBalance: target } });
  }

  // Step 3: restore settings
  const settings = await CoinSettings.getSingleton();
  console.log('Step 3: CoinSettings restore ->', JSON.stringify(snap.settings));
  if (!dry) {
    for (const f of SETTINGS_FIELDS) settings[f] = snap.settings[f];
    await settings.save();
  }
  console.log(dry ? 'Dry run complete.' : 'Cleanup complete.');
  void mongoose;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(USAGE); return 0; }
  const errs = validateArgs(args);
  if (errs.length) { console.error(errs.join('\n') + '\n\n' + USAGE); return 1; }
  require('dotenv').config();
  if (!process.env.MONGO_URI) { console.error('MONGO_URI is not set (check .env)'); return 1; }
  const mongoose = require('mongoose');
  let code = 0;
  try {
    await mongoose.connect(process.env.MONGO_URI);
    if (args.mode === 'snapshot') await snapshot(args); else await cleanup(args);
  } catch (e) {
    console.error('Error:', e.message);
    code = 1;
  } finally {
    await mongoose.disconnect();
  }
  return code;
}

module.exports = { parseArgs, assertSafePrefix, validateArgs, SNAPSHOT_PATH };

if (require.main === module) main().then((c) => process.exit(c));
