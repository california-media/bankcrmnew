const test = require('node:test');
const assert = require('node:assert/strict');
const Company = require('../models/Company');
const ctrl = require('../controllers/company.controller');

const fakeRes = () => {
  const r = { statusCode: 200, body: undefined, ended: false };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => { r.ended = true; return r; };
  return r;
};
const ID = '6a1b2c3d4e5f60718293a401';
const findChain = (docs, spy) => (filter) => {
  if (spy) spy.push(filter);
  const c = { select: () => c, sort: () => c, skip: () => c, limit: () => c, lean: async () => docs };
  return c;
};

test('search: starts-with first, then contains, no repeats', async (t) => {
  const filters = [];
  let call = 0;
  t.mock.method(Company, 'find', (f) => {
    call += 1;
    return findChain(call === 1
      ? [{ _id: 'a', name: 'Emaar', nameKey: 'emaar' }]
      : [{ _id: 'b', name: 'Dubai Emaar', nameKey: 'dubai emaar' }], filters)(f);
  });
  const res = fakeRes();
  await ctrl.search({ query: { q: ' EMA ', limit: '5' } }, res);
  assert.deepEqual(res.body.items.map((i) => i.name), ['Emaar', 'Dubai Emaar']);
  assert.equal(filters[0].nameKey.source, '^ema');
  assert.deepEqual([filters[1].nameKey.$regex, filters[1].nameKey.$nin], ['ema', ['emaar']]);
});
test('search: escapes regex chars', async (t) => {
  const filters = [];
  t.mock.method(Company, 'find', findChain([], filters));
  const res = fakeRes();
  await ctrl.search({ query: { q: 'a.*(', limit: '999' } }, res);
  assert.equal(filters[0].nameKey.source, '^a\\.\\*\\(');
  assert.equal(res.statusCode, 200);
});
test('search: nothing until something is typed', async (t) => {
  t.mock.method(Company, 'find', () => { throw new Error('should not query'); });
  const res = fakeRes();
  await ctrl.search({ query: { q: '   ' } }, res);
  assert.deepEqual(res.body.items, []);
});
test('search: one entry per company; banks only for admin, agency and agency staff', async (t) => {
  t.mock.method(Company, 'find', findChain([
    { _id: 'a', name: 'Emaar', nameKey: 'emaar', bankName: 'ENBD', category: 'Cat A', notes: '' },
    { _id: 'b', name: 'EMAAR', nameKey: 'emaar', bankName: 'FAB', category: 'Cat C', notes: 'Check' },
    { _id: 'c', name: 'Emaar Malls', nameKey: 'emaar malls', bankName: '', category: '', notes: '' },
  ]));
  const banks = [{ bankName: 'ENBD', category: 'Cat A', notes: '' }, { bankName: 'FAB', category: 'Cat C', notes: 'Check' }];
  for (const [user, full] of [[undefined, false], [{ role: 'agent' }, false], [{ role: 'admin' }, true], [{ role: 'agency' }, true], [{ role: 'employee' }, true]]) {
    const res = fakeRes();
    await ctrl.search({ query: { q: 'emaar', limit: '2' }, user }, res);
    assert.deepEqual(res.body.items, full
      ? [{ _id: 'a', name: 'Emaar', banks }, { _id: 'c', name: 'Emaar Malls', banks: [] }]
      : [{ _id: 'a', name: 'Emaar' }, { _id: 'c', name: 'Emaar Malls' }], JSON.stringify(user));
  }
});
test('search: when the read hits its cap the last company is left out', async (t) => {
  const docs = Array.from({ length: 15 }, (_, i) => ({ _id: `x${i}`, name: i < 14 ? 'Aa' : 'Ab', nameKey: i < 14 ? 'aa' : 'ab', bankName: `B${i}` }));
  let call = 0;
  t.mock.method(Company, 'find', () => { call += 1; return findChain(call === 1 ? docs : [])(); });
  const res = fakeRes();
  await ctrl.search({ query: { q: 'a', limit: '1' } }, res);
  assert.deepEqual(res.body.items, [{ _id: 'x0', name: 'Aa' }]);
});

test('bulk: dedupes, counts invalid and existing, inserts the rest', async (t) => {
  t.mock.method(Company, 'find', findChain([{ nameKey: 'emaar' }]));
  let inserted;
  t.mock.method(Company, 'insertMany', async (docs) => { inserted = docs; return docs; });
  const res = fakeRes();
  await ctrl.bulk({ body: { names: ['Emaar', ' Nakheel  Properties ', 'nakheel properties', 'x', 5, 'Damac'] }, user: { _id: 'u' } }, res);
  assert.deepEqual(res.body, { added: 2, updated: 0, duplicates: 2, invalid: 2 });
  assert.deepEqual(inserted.map((d) => d.name), ['Nakheel Properties', 'Damac']);
  assert.equal(inserted[0].nameKey, 'nakheel properties');
});
test('bulk: tolerates E11000 race', async (t) => {
  t.mock.method(Company, 'find', findChain([]));
  t.mock.method(Company, 'insertMany', async () => { const e = new Error('dup'); e.writeErrors = [{ code: 11000 }]; throw e; });
  const res = fakeRes();
  await ctrl.bulk({ body: { names: ['Aa', 'Bb'] }, user: { _id: 'u' } }, res);
  assert.deepEqual(res.body, { added: 1, updated: 0, duplicates: 1, invalid: 0 });
});
test('bulk: one row per company + bank; existing pairs get category / notes updated', async (t) => {
  t.mock.method(Company, 'find', findChain([
    { _id: 'e1', nameKey: 'emaar', bankKey: 'enbd', category: 'Cat A', notes: '' },
    { _id: 'd1', nameKey: 'damac', bankKey: 'enbd', category: 'Cat A', notes: '' },
  ]));
  let inserted; let writes;
  t.mock.method(Company, 'insertMany', async (docs) => { inserted = docs; return docs; });
  t.mock.method(Company, 'bulkWrite', async (ops) => { writes = ops; return {}; });
  const res = fakeRes();
  await ctrl.bulk({ body: { rows: [
    { name: 'Nakheel', bankName: ' ADCB  Bank ', category: ' Cat A ', notes: 'Listed' },
    { name: 'NAKHEEL', bankName: 'FAB', category: 'Cat C', notes: '' },
    { name: 'nakheel', bankName: 'adcb bank', category: 'Cat B', notes: '' },
    { name: 'Emaar', bankName: 'enbd', category: 'Cat B', notes: '' },
    { name: 'Damac', bankName: 'ENBD', category: 'Cat A', notes: '' },
    null,
  ] }, user: { _id: 'u' } }, res);
  assert.deepEqual(res.body, { added: 2, updated: 1, duplicates: 2, invalid: 1 });
  assert.deepEqual(inserted.map((d) => [d.name, d.nameKey, d.bankName, d.bankKey, d.category, d.notes]), [
    ['Nakheel', 'nakheel', 'ADCB Bank', 'adcb bank', 'Cat A', 'Listed'],
    ['NAKHEEL', 'nakheel', 'FAB', 'fab', 'Cat C', ''],
  ]);
  assert.deepEqual(writes, [{ updateOne: { filter: { _id: 'e1' }, update: { $set: { category: 'Cat B' } } } }]);
});
test('bulk: rejects non-array and over 5000', async () => {
  let res = fakeRes();
  await ctrl.bulk({ body: { names: 'x' } }, res);
  assert.equal(res.statusCode, 400);
  res = fakeRes();
  await ctrl.bulk({ body: { names: new Array(5001).fill('Abc') } }, res);
  assert.equal(res.statusCode, 400);
});

test('update: 400 invalid, 404 missing, 409 duplicate, 200 ok', async (t) => {
  let res = fakeRes();
  await ctrl.update({ params: { id: ID }, body: { name: 'a' } }, res);
  assert.equal(res.statusCode, 400);

  t.mock.method(Company, 'findById', async () => null);
  res = fakeRes();
  await ctrl.update({ params: { id: ID }, body: { name: 'Valid' } }, res);
  assert.equal(res.statusCode, 404);

  const doc = { _id: ID, name: 'Old', bankName: 'FAB', createdAt: 'c', save: async () => {} };
  Company.findById.mock.mockImplementation(async () => doc);
  t.mock.method(Company, 'findOne', () => ({ select: () => ({ lean: async () => ({ _id: 'other' }) }) }));
  res = fakeRes();
  await ctrl.update({ params: { id: ID }, body: { name: 'Valid' } }, res);
  assert.equal(res.statusCode, 409);

  const clashFilters = [];
  Company.findOne.mock.mockImplementation((f) => { clashFilters.push(f); return { select: () => ({ lean: async () => null }) }; });
  res = fakeRes();
  await ctrl.update({ params: { id: ID }, body: { name: 'Old' } }, res);
  assert.deepEqual([clashFilters[0].nameKey, clashFilters[0].bankKey, doc.bankName], ['old', 'fab', 'FAB']);
  res = fakeRes();
  await ctrl.update({ params: { id: ID }, body: { name: '  New   Name ', category: ' Cat A ', bankName: ' ENBD ', notes: ' Listed ' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(doc.name, 'New Name');
  assert.equal(doc.nameKey, 'new name');
  assert.deepEqual([doc.category, doc.bankName, doc.bankKey, doc.notes], ['Cat A', 'ENBD', 'enbd', 'Listed']);
  assert.deepEqual([res.body.category, res.body.bankName, res.body.notes], ['Cat A', 'ENBD', 'Listed']);
});

test('remove: 204 and 404', async (t) => {
  t.mock.method(Company, 'findByIdAndDelete', async () => ({ _id: ID }));
  let res = fakeRes();
  await ctrl.remove({ params: { id: ID } }, res);
  assert.equal(res.statusCode, 204);
  Company.findByIdAndDelete.mock.mockImplementation(async () => null);
  res = fakeRes();
  await ctrl.remove({ params: { id: ID } }, res);
  assert.equal(res.statusCode, 404);
});

test('bulkRemove: deletes valid ids, skips bad ones, rejects empty or over 5000', async (t) => {
  let filter;
  t.mock.method(Company, 'deleteMany', async (f) => { filter = f; return { deletedCount: 1 }; });
  let res = fakeRes();
  await ctrl.bulkRemove({ body: { ids: [ID, ID, 'nope'] } }, res);
  assert.deepEqual(filter, { _id: { $in: [ID] } });
  assert.deepEqual(res.body, { deleted: 1 });

  res = fakeRes();
  await ctrl.bulkRemove({ body: { ids: [] } }, res);
  assert.equal(res.statusCode, 400);
  res = fakeRes();
  await ctrl.bulkRemove({ body: { ids: new Array(5001).fill(ID) } }, res);
  assert.equal(res.statusCode, 400);
});

test('list: page size from limit, capped at 1000', async (t) => {
  const skips = []; const limits = [];
  t.mock.method(Company, 'find', () => {
    const c = { select: () => c, sort: () => c, skip: (n) => { skips.push(n); return c; }, limit: (n) => { limits.push(n); return c; }, lean: async () => [] };
    return c;
  });
  t.mock.method(Company, 'countDocuments', async () => 2500);
  let res = fakeRes();
  await ctrl.list({ query: { page: '3', limit: '500' } }, res);
  assert.deepEqual([skips[0], limits[0], res.body.pages], [1000, 500, 5]);
  res = fakeRes();
  await ctrl.list({ query: { limit: '99999' } }, res);
  assert.equal(limits[1], 1000);
  res = fakeRes();
  await ctrl.list({ query: {} }, res);
  assert.equal(limits[2], 50);
});
test('ids: every id matching the search', async (t) => {
  const filters = [];
  t.mock.method(Company, 'find', findChain([{ _id: 'a' }, { _id: 'b' }], filters));
  const res = fakeRes();
  await ctrl.ids({ query: { q: 'EM' } }, res);
  assert.deepEqual(res.body, { ids: ['a', 'b'] });
  assert.equal(filters[0].nameKey.source, 'em');
});

test('details: all bank rows for the exact name, or not found', async (t) => {
  const filters = [];
  t.mock.method(Company, 'find', findChain([
    { _id: 'a', name: '101 Computer Embroidery', nameKey: '101 computer embroidery', bankName: 'ENBD', category: 'Cat B', notes: '' },
    { _id: 'b', name: '101 COMPUTER EMBROIDERY', nameKey: '101 computer embroidery', bankName: 'FAB', category: 'Cat C', notes: 'x' },
  ], filters));
  let res = fakeRes();
  await ctrl.details({ query: { name: ' 101  COMPUTER Embroidery ' } }, res);
  assert.equal(filters[0].nameKey, '101 computer embroidery');
  assert.deepEqual(res.body, {
    found: true,
    name: '101 Computer Embroidery',
    banks: [{ bankName: 'ENBD', category: 'Cat B', notes: '' }, { bankName: 'FAB', category: 'Cat C', notes: 'x' }],
  });
  Company.find.mock.mockImplementation(findChain([]));
  res = fakeRes();
  await ctrl.details({ query: { name: 'Nope' } }, res);
  assert.deepEqual(res.body, { found: false, banks: [] });
  res = fakeRes();
  await ctrl.details({ query: {} }, res);
  assert.deepEqual(res.body, { found: false, banks: [] });
});
