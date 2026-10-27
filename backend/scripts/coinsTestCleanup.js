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

// Pure-ish core: all DB access goes through injected models so it can be tested with fakes.
async function runCleanup({ models, snap, args, log = console.log }) {
  const { CoinSettings, CoinTransaction, SpinLog, Voucher, VoucherCode, Redemption, User } = models;
  const takenAt = new Date(snap.takenAt);
  if (isNaN(takenAt)) throw new Error('Snapshot has invalid takenAt');
  const prefix = assertSafePrefix(args.voucherPrefix);
  const dry = args.dryRun;
  log(dry ? '[DRY RUN] nothing will be written' : 'Cleaning up');

  const users = await loadUsers(User, args.users);
  const snapByEmail = new Map(snap.users.map((u) => [u.email.toLowerCase(), u]));
  for (const u of users) {
    const su = snapByEmail.get(u.email.toLowerCase());
    if (!su) throw new Error(`User missing from snapshot: ${u.email}`);
    if (String(su._id) !== String(u._id)) throw new Error(`Snapshot _id mismatch for ${u.email}`);
  }
  const listed = new Set(users.map((u) => u.email.toLowerCase()));
  const unlisted = snap.users.filter((u) => !listed.has(u.email.toLowerCase()));
  if (unlisted.length) log(`WARNING: snapshot has users not listed in --users: ${unlisted.map((u) => u.email).join(', ')}`);
  const userIds = users.map((u) => u._id);

  // Step 1: vouchers with the prefix, created after the snapshot
  const vouchers = await Voucher.find({
    title: { $regex: `^${escapeRegex(prefix)}` },
    createdAt: { $gte: takenAt },
  }).select('title logo');
  const voucherIds = vouchers.map((v) => v._id);
  log(`Step 1: ${vouchers.length} voucher(s) matching prefix ${JSON.stringify(prefix)} created since snapshot`);
  vouchers.forEach((v) => log(`  - ${v.title}${v.logo ? ` (S3 logo: ${v.logo} - delete manually)` : ''}`));
  if (voucherIds.length) {
    // Abort if anyone other than the listed users redeemed these vouchers.
    const foreign = await Redemption.find({
      voucher: { $in: voucherIds },
      user: { $nin: userIds },
    }).select('user coinCost createdAt');
    if (foreign.length) {
      const owners = await User.find({ _id: { $in: foreign.map((r) => r.user) } }).select('email');
      const emailById = new Map(owners.map((o) => [String(o._id), o.email]));
      log('ABORT: redemptions by non-listed users exist on matched vouchers (decide refunds manually):');
      foreign.forEach((r) => log(`  - ${emailById.get(String(r.user)) || r.user} redemption=${r._id} coinCost=${r.coinCost} createdAt=${r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt}`));
      throw new Error(`${foreign.length} redemption(s) by non-listed users; nothing was changed`);
    }
    const redemptionFilter = { voucher: { $in: voucherIds }, user: { $in: userIds } };
    const redemptions = await Redemption.find(redemptionFilter).select('_id');
    const redemptionIds = redemptions.map((r) => r._id);
    const txFilter = { redemption: { $in: redemptionIds }, user: { $in: userIds } };
    const codeFilter = { voucher: { $in: voucherIds } };
    const voucherFilter = { _id: { $in: voucherIds } };
    let nTx, nRed, nCodes, nVouchers;
    if (dry) {
      nTx = redemptionIds.length ? await CoinTransaction.countDocuments(txFilter) : 0;
      nRed = redemptionIds.length;
      nCodes = await VoucherCode.countDocuments(codeFilter);
      nVouchers = voucherIds.length;
    } else {
      nTx = redemptionIds.length ? (await CoinTransaction.deleteMany(txFilter)).deletedCount : 0;
      nRed = redemptionIds.length ? (await Redemption.deleteMany(redemptionFilter)).deletedCount : 0;
      nCodes = (await VoucherCode.deleteMany(codeFilter)).deletedCount;
      nVouchers = (await Voucher.deleteMany(voucherFilter)).deletedCount;
    }
    log(`  CoinTransactions (redemptions): ${nTx}, Redemptions: ${nRed}, VoucherCodes: ${nCodes}, Vouchers: ${nVouchers}`);
  }

  // Step 2: listed users' activity since snapshot
  const since = { user: { $in: userIds }, createdAt: { $gte: takenAt } };
  const nTx2 = dry ? await CoinTransaction.countDocuments(since) : (await CoinTransaction.deleteMany(since)).deletedCount;
  const nSpin = dry ? await SpinLog.countDocuments(since) : (await SpinLog.deleteMany(since)).deletedCount;
  log(`Step 2: CoinTransactions since ${snap.takenAt}: ${nTx2}, SpinLogs: ${nSpin}`);
  for (const u of users) {
    const target = snapByEmail.get(u.email.toLowerCase()).coinBalance;
    log(`  ${u.email}: coinBalance ${u.coinBalance || 0} -> ${target}`);
    if (!dry) await User.updateOne({ _id: u._id }, { $set: { coinBalance: target } });
  }

  // Step 3: restore settings
  const settings = await CoinSettings.getSingleton();
  log('Step 3: CoinSettings restore ->', JSON.stringify(snap.settings));
  if (!dry) {
    for (const f of SETTINGS_FIELDS) settings[f] = snap.settings[f];
    await settings.save();
  }
  log(dry ? 'Dry run complete.' : 'Cleanup complete.');
}

async function cleanup(args) {
  if (!fs.existsSync(SNAPSHOT_PATH)) throw new Error(`No snapshot at ${SNAPSHOT_PATH}; run --snapshot first`);
  const snap = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const models = {
    CoinSettings: require('../models/CoinSettings'),
    CoinTransaction: require('../models/CoinTransaction'),
    SpinLog: require('../models/SpinLog'),
    Voucher: require('../models/Voucher'),
    VoucherCode: require('../models/VoucherCode'),
    Redemption: require('../models/Redemption'),
    User: require('../models/User'),
  };
  await runCleanup({ models, snap, args });
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
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false });
    if (args.mode === 'snapshot') await snapshot(args); else await cleanup(args);
  } catch (e) {
    console.error('Error:', e.message);
    code = 1;
  } finally {
    await mongoose.disconnect();
  }
  return code;
}

module.exports = { runCleanup, parseArgs, assertSafePrefix, validateArgs, SNAPSHOT_PATH };

if (require.main === module) main().then((c) => process.exit(c));
