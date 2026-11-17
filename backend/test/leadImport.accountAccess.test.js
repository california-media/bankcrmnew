const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const Lead = require('../models/Lead');
const User = require('../models/User');
const router = require('../routes/lead.routes');
const ctrl = require('../controllers/lead.controller');

// No DB is touched: model statics are stubbed per test (t.mock.method restores them).
const fakeRes = () => {
  const r = { statusCode: 200, body: undefined };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};

const importGate = () => {
  const layer = router.stack.find((l) => l.route?.path === '/import' && l.route.methods.post);
  return layer.route.stack[0].handle;
};

const runGate = (user) => {
  const res = fakeRes();
  let passed = false;
  importGate()({ user }, res, () => { passed = true; });
  return { passed, res };
};

const xlsxFile = (rows) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Leads');
  return { buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) };
};

const AGENCY_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER_AGENCY_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const ACCOUNT_USER = { _id: 'cccccccccccccccccccccccc', role: 'employee', employeeType: 'account', agency: AGENCY_ID };

test('import gate: Account Access employee may import', () => {
  assert.equal(runGate(ACCOUNT_USER).passed, true);
});

test('import gate: Coordinator and agency owner still allowed', () => {
  assert.equal(runGate({ role: 'employee', employeeType: 'coordinator', agency: AGENCY_ID }).passed, true);
  assert.equal(runGate({ role: 'agency', _id: AGENCY_ID }).passed, true);
});

test('import gate: CPV/Sales employees and agents still forbidden', () => {
  for (const user of [{ role: 'employee', employeeType: 'cpv' }, { role: 'employee', employeeType: 'sales' }, { role: 'agent' }]) {
    const { passed, res } = runGate(user);
    assert.equal(passed, false, JSON.stringify(user));
    assert.equal(res.statusCode, 403);
  }
});

test('import: Account Access is limited to its own agency leads', async (t) => {
  const leads = {
    'LD-OWN-0001': { _id: 'l1', leadNumber: 'LD-OWN-0001', agency: AGENCY_ID },
    'LD-OTHER-0001': { _id: 'l2', leadNumber: 'LD-OTHER-0001', agency: OTHER_AGENCY_ID },
  };
  t.mock.method(Lead, 'findOne', async (q) => leads[q.leadNumber] || null);
  const updates = [];
  t.mock.method(Lead, 'findByIdAndUpdate', async (id, u) => { updates.push([id, u]); return {}; });
  // Post-import admin notification: no admins → nothing emitted.
  t.mock.method(User, 'find', () => { const c = { select: () => c, lean: async () => [] }; return c; });

  const res = fakeRes();
  await ctrl.importLeads({
    user: ACCOUNT_USER,
    file: xlsxFile([
      { 'Lead No': 'LD-OWN-0001', Phone: '971501234567', Status: 'Approved' },
      { 'Lead No': 'LD-OTHER-0001', Phone: '971501234567', Status: 'Approved' },
    ]),
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.updated, 1);
  assert.deepEqual(res.body.failed, [{ row: 3, reason: 'Lead No "LD-OTHER-0001" does not belong to your agency' }]);
  assert.equal(updates.length, 1);
  assert.equal(updates[0][0], 'l1');
  assert.equal(updates[0][1].$set.status, 'approved');
  assert.equal(updates[0][1].$set.agency, AGENCY_ID);
});
