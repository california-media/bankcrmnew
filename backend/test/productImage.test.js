const test = require('node:test');
const assert = require('node:assert/strict');
const upload = require('../middleware/upload.middleware');
const cache = require('../utils/publicCardCache');
const LoanProduct = require('../models/LoanProduct');
const AccountProduct = require('../models/AccountProduct');
const loanCtrl = require('../controllers/loanProduct.controller');
const accountCtrl = require('../controllers/accountProduct.controller');

// Loan and account products get a picture, like card products. It is uploaded
// on its own after the product is saved, so the product forms stay plain JSON.
// No DB or S3 is touched: model statics and the S3 delete are stubbed.

const ID = '666666666666666666666666';
const fakeRes = () => {
  const r = { statusCode: 200, body: undefined };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};
const chain = (doc) => ({ select: async () => doc, populate: async () => doc, then: (ok, ko) => Promise.resolve(doc).then(ok, ko) });

function stub(t, Model, { existing }) {
  const seen = { deleted: [], updates: [], notified: 0 };
  t.mock.method(upload, 'deleteFromS3', (subdir, filename) => { seen.deleted.push(`${subdir}/${filename}`); });
  t.mock.method(cache, 'notifyWebsiteProductsChanged', () => { seen.notified += 1; });
  t.mock.method(Model, 'findById', () => chain(existing));
  t.mock.method(Model, 'findByIdAndUpdate', (id, update) => {
    seen.updates.push(update);
    if (!existing) return chain(null);
    const next = { ...existing, ...(update.$set || {}) };
    if (update.$unset) Object.keys(update.$unset).forEach((k) => delete next[k]);
    return chain(next);
  });
  t.mock.method(Model, 'findByIdAndDelete', async () => existing);
  return seen;
}

for (const [name, Model, ctrl, subdir] of [
  ['loan', LoanProduct, loanCtrl, 'loan-images'],
  ['account', AccountProduct, accountCtrl, 'account-images'],
]) {
  test(`${name}: upload sets the picture and removes the old one`, async (t) => {
    const seen = stub(t, Model, { existing: { _id: ID, name: 'P', productImage: 'old.png' } });
    const res = fakeRes();
    await ctrl.uploadImage({ params: { id: ID }, file: { key: `${subdir}/new.png` } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.productImage, 'new.png');
    assert.deepEqual(seen.updates, [{ $set: { productImage: 'new.png' } }]);
    assert.deepEqual(seen.deleted, [`${subdir}/old.png`]);
    assert.equal(seen.notified, 1);
  });

  test(`${name}: upload without a file is refused`, async (t) => {
    const seen = stub(t, Model, { existing: { _id: ID } });
    const res = fakeRes();
    await ctrl.uploadImage({ params: { id: ID } }, res);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(seen.updates, []);
  });

  test(`${name}: upload for a product that does not exist cleans up the file`, async (t) => {
    const seen = stub(t, Model, { existing: null });
    const res = fakeRes();
    await ctrl.uploadImage({ params: { id: ID }, file: { key: `${subdir}/new.png` } }, res);
    assert.equal(res.statusCode, 404);
    assert.deepEqual(seen.deleted, [`${subdir}/new.png`]);
  });

  test(`${name}: remove clears the picture and deletes the file`, async (t) => {
    const seen = stub(t, Model, { existing: { _id: ID, name: 'P', productImage: 'old.png' } });
    const res = fakeRes();
    await ctrl.removeImage({ params: { id: ID } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.productImage, undefined);
    assert.deepEqual(seen.updates, [{ $unset: { productImage: 1 } }]);
    assert.deepEqual(seen.deleted, [`${subdir}/old.png`]);
  });

  test(`${name}: deleting the product deletes its picture`, async (t) => {
    const seen = stub(t, Model, { existing: { _id: ID, name: 'P', productImage: 'old.png' } });
    const res = fakeRes();
    await ctrl.remove({ params: { id: ID } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(seen.deleted, [`${subdir}/old.png`]);
  });
}
