const test = require('node:test');
const assert = require('node:assert/strict');
const ProductOfMonth = require('../models/ProductOfMonth');
const CardProduct = require('../models/CardProduct');
const LoanProduct = require('../models/LoanProduct');
const AccountProduct = require('../models/AccountProduct');
const ctrl = require('../controllers/productOfMonth.controller');

const fakeRes = () => {
  const r = { statusCode: 200, body: undefined };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};
const id = (n) => `6a1b2c3d4e5f60718293a4${String(n).padStart(2, '0')}`;
const chain = (docs) => { const c = { select: () => c, populate: () => c, lean: async () => docs }; return c; };

function stub(t, { card = [], loan = [], account = [], doc } = {}) {
  t.mock.method(CardProduct, 'find', () => chain(card));
  t.mock.method(LoanProduct, 'find', () => chain(loan));
  t.mock.method(AccountProduct, 'find', () => chain(account));
  const singleton = doc || { items: [], save: async () => {} };
  t.mock.method(ProductOfMonth, 'getSingleton', async () => singleton);
  return singleton;
}
const put = async (items) => { const res = fakeRes(); await ctrl.updateAdmin({ body: { items }, user: { _id: 'u1' } }, res); return res; };
const prod = (n, extra = {}) => ({ _id: id(n), name: `P${n}`, bank: { _id: 'b1', name: 'Bank', logo: 'l.png' }, isActive: true, agentVisible: true, commissionBrackets: [], ...extra });

test('PUT rejects bad type', async (t) => {
  stub(t);
  const r = await put([{ productType: 'bogus', product: id(1) }]);
  assert.equal(r.statusCode, 400);
});
test('PUT rejects unknown product', async (t) => {
  stub(t, { card: [] });
  const r = await put([{ productType: 'credit_card', product: id(1) }]);
  assert.equal(r.statusCode, 400);
  assert.match(r.body.message, /Unknown/);
});
test('PUT rejects more than 6 items', async (t) => {
  stub(t);
  const items = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ productType: 'loan', product: id(n) }));
  assert.equal((await put(items)).statusCode, 400);
});
test('PUT rejects duplicates', async (t) => {
  stub(t, { card: [prod(1)] });
  const r = await put([{ productType: 'credit_card', product: id(1) }, { productType: 'credit_card', product: id(1) }]);
  assert.equal(r.statusCode, 400);
  assert.match(r.body.message, /Duplicate/);
});
test('PUT rejects tagline over 80', async (t) => {
  stub(t, { card: [prod(1)] });
  const r = await put([{ productType: 'credit_card', product: id(1), tagline: 'x'.repeat(81) }]);
  assert.equal(r.statusCode, 400);
});
test('PUT saves valid list and returns it', async (t) => {
  const doc = stub(t, { card: [prod(1)], loan: [prod(2)] });
  const r = await put([{ productType: 'credit_card', product: id(1), tagline: ' Hi ' }, { productType: 'loan', product: id(2) }]);
  assert.equal(r.statusCode, 200);
  assert.equal(doc.items.length, 2);
  assert.equal(doc.items[0].tagline, 'Hi');
  assert.deepEqual(r.body.items.map((i) => i.product.name), ['P1', 'P2']);
});

test('GET agent drops inactive / hidden / deleted and strips private fields', async (t) => {
  const secret = { receivable: 999, assignedAgencies: ['a1'], agency: { email: 'x@y.z' } };
  stub(t, {
    card: [
      prod(1, { ...secret, cardImage: 'c.png', cardType: 'travel', commissionBrackets: [{ minimumSalary: 5000, receivable: 500, payable: 300, feeType: 'free', agencyOverride: 10, agencyOverridePct: 0, annualFeeAmount: 1 }] }),
      prod(2, { isActive: false }),
      prod(3, { agentVisible: false }),
    ],
    loan: [prod(4, secret)],
    doc: { items: ['credit_card:1', 'credit_card:2', 'credit_card:3', 'credit_card:9', 'loan:4'].map((k, i) => {
      const [productType, n] = k.split(':'); return { productType, product: id(n), tagline: i === 0 ? 'Best' : '' };
    }) },
  });
  const res = fakeRes();
  await ctrl.getForAgent({}, res);
  assert.deepEqual(res.body.items.map((i) => i.product._id), [id(1), id(4)]);
  assert.equal(res.body.items[0].tagline, 'Best');
  const json = JSON.stringify(res.body);
  for (const bad of ['receivable', 'assignedAgencies', 'x@y.z', 'email', 'annualFeeAmount']) assert.ok(!json.includes(bad), bad);
  assert.deepEqual(Object.keys(res.body.items[0].product.commissionBrackets[0]).sort(), ['agencyOverride', 'agencyOverridePct', 'feeType', 'minimumSalary', 'payable']);
  assert.equal(res.body.items[0].product.cardType, 'travel');
});
