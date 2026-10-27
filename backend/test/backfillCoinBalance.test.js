const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs, runBackfill, FILTER, UPDATE } = require('../scripts/backfillCoinBalance');

test('backfillCoinBalance parseArgs: --dry-run, --help, unknown args', () => {
  assert.deepEqual(parseArgs([]), { dryRun: false, help: false, errors: [] });
  assert.equal(parseArgs(['--dry-run']).dryRun, true);
  assert.equal(parseArgs(['-h']).help, true);
  assert.equal(parseArgs(['--bogus']).errors.length, 1);
});

test('backfillCoinBalance: only touches users missing the field, never an existing balance', () => {
  assert.deepEqual(FILTER, { coinBalance: { $exists: false } });
  assert.deepEqual(UPDATE, { $set: { coinBalance: 0 } });
});

function fakeUser(missing) {
  const writes = [];
  const counts = [];
  return {
    writes,
    counts,
    User: {
      countDocuments: async (f) => { counts.push(f); return missing; },
      updateMany: async (f, u, o) => { writes.push([f, u, o]); const n = missing; missing = 0; return { matchedCount: n, modifiedCount: n }; },
    },
  };
}

test('backfillCoinBalance: dry run counts and writes nothing', async () => {
  const f = fakeUser(7);
  const r = await runBackfill({ User: f.User, dryRun: true, log: () => {} });
  assert.equal(f.writes.length, 0);
  assert.deepEqual(f.counts, [FILTER]);
  assert.deepEqual(r, { missing: 7, updated: 0 });
});

test('backfillCoinBalance: one guarded updateMany without bumping updatedAt; idempotent', async () => {
  const f = fakeUser(7);
  const r1 = await runBackfill({ User: f.User, dryRun: false, log: () => {} });
  assert.deepEqual(f.writes[0], [FILTER, UPDATE, { timestamps: false }]);
  assert.deepEqual(r1, { missing: 7, updated: 7 });
  const r2 = await runBackfill({ User: f.User, dryRun: false, log: () => {} });
  assert.deepEqual(r2, { missing: 0, updated: 0 });
});
