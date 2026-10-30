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
    return findChain(call === 1 ? [{ _id: 'a', name: 'Emaar' }] : [{ _id: 'b', name: 'Dubai Emaar' }], filters)(f);
  });
  const res = fakeRes();
  await ctrl.search({ query: { q: ' ema ', limit: '5' } }, res);
  assert.deepEqual(res.body.items.map((i) => i.name), ['Emaar', 'Dubai Emaar']);
  assert.equal(filters[0].name.source, '^ema');
  assert.deepEqual(filters[1]._id.$nin, ['a']);
});
test('search: escapes regex chars', async (t) => {
  const filters = [];
  t.mock.method(Company, 'find', findChain([], filters));
  const res = fakeRes();
  await ctrl.search({ query: { q: 'a.*(', limit: '999' } }, res);
  assert.equal(filters[0].name.source, '^a\\.\\*\\(');
  assert.equal(res.statusCode, 200);
});
test('search: empty q lists alphabetically', async (t) => {
  t.mock.method(Company, 'find', findChain([{ _id: 'a', name: 'A Co', nameKey: 'a co' }]));
  const res = fakeRes();
  await ctrl.search({ query: {} }, res);
  assert.deepEqual(res.body.items, [{ _id: 'a', name: 'A Co' }]);
});

test('bulk: dedupes, counts invalid and existing, inserts the rest', async (t) => {
  t.mock.method(Company, 'find', findChain([{ nameKey: 'emaar' }]));
  let inserted;
  t.mock.method(Company, 'insertMany', async (docs) => { inserted = docs; return docs; });
  const res = fakeRes();
  await ctrl.bulk({ body: { names: ['Emaar', ' Nakheel  Properties ', 'nakheel properties', 'x', 5, 'Damac'] }, user: { _id: 'u' } }, res);
  assert.deepEqual(res.body, { added: 2, duplicates: 2, invalid: 2 });
  assert.deepEqual(inserted.map((d) => d.name), ['Nakheel Properties', 'Damac']);
  assert.equal(inserted[0].nameKey, 'nakheel properties');
});
test('bulk: tolerates E11000 race', async (t) => {
  t.mock.method(Company, 'find', findChain([]));
  t.mock.method(Company, 'insertMany', async () => { const e = new Error('dup'); e.writeErrors = [{ code: 11000 }]; throw e; });
  const res = fakeRes();
  await ctrl.bulk({ body: { names: ['Aa', 'Bb'] }, user: { _id: 'u' } }, res);
  assert.deepEqual(res.body, { added: 1, duplicates: 1, invalid: 0 });
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

  const doc = { _id: ID, name: 'Old', createdAt: 'c', save: async () => {} };
  Company.findById.mock.mockImplementation(async () => doc);
  t.mock.method(Company, 'findOne', () => ({ select: () => ({ lean: async () => ({ _id: 'other' }) }) }));
  res = fakeRes();
  await ctrl.update({ params: { id: ID }, body: { name: 'Valid' } }, res);
  assert.equal(res.statusCode, 409);

  Company.findOne.mock.mockImplementation(() => ({ select: () => ({ lean: async () => null }) }));
  res = fakeRes();
  await ctrl.update({ params: { id: ID }, body: { name: '  New   Name ' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(doc.name, 'New Name');
  assert.equal(doc.nameKey, 'new name');
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
