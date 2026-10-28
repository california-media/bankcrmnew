const mongoose = require('mongoose');
const ProductOfMonth = require('../models/ProductOfMonth');
const CardProduct = require('../models/CardProduct');
const LoanProduct = require('../models/LoanProduct');
const AccountProduct = require('../models/AccountProduct');

const MAX_ITEMS = 6;
const MAX_TAGLINE = 80;
const MODELS = { credit_card: CardProduct, loan: LoanProduct, account: AccountProduct };
const TYPES = Object.keys(MODELS);

// Explicit whitelist — never receivable, assignedAgencies, agency, or agency email.
const AGENT_FIELDS = {
  credit_card: '_id name bank cardImage cardType commissionBrackets isActive agentVisible',
  loan: '_id name bank commissionBrackets isActive agentVisible',
  account: '_id name bank commissionBrackets isActive agentVisible',
};

const shapeBracket = (b) => ({
  minimumSalary: b.minimumSalary,
  payable: b.payable,
  feeType: b.feeType,
  agencyOverride: b.agencyOverride,
  agencyOverridePct: b.agencyOverridePct,
});

const shapeAgentProduct = (p) => {
  const out = {
    _id: p._id,
    name: p.name,
    bank: p.bank && typeof p.bank === 'object' ? { _id: p.bank._id, name: p.bank.name, logo: p.bank.logo } : p.bank,
    commissionBrackets: (p.commissionBrackets || []).map(shapeBracket),
    isActive: p.isActive,
    agentVisible: p.agentVisible,
  };
  if (p.cardImage !== undefined) out.cardImage = p.cardImage;
  if (p.cardType !== undefined) out.cardType = p.cardType;
  return out;
};

// Load products per type, keyed by id string.
async function loadProducts(items, select) {
  const map = {};
  await Promise.all(TYPES.map(async (type) => {
    const ids = items.filter((i) => i.productType === type).map((i) => i.product);
    if (!ids.length) return;
    const docs = await MODELS[type].find({ _id: { $in: ids } }).select(select(type)).populate('bank', 'name logo').lean();
    docs.forEach((d) => { map[`${type}:${d._id}`] = d; });
  }));
  return map;
}

const adminList = async (doc) => {
  const items = doc.items.map((i) => ({ productType: i.productType, product: i.product, tagline: i.tagline || '' }));
  const map = await loadProducts(items, () => '_id name bank');
  return items
    .map((i) => {
      const p = map[`${i.productType}:${i.product}`];
      if (!p) return null;
      return {
        productType: i.productType,
        tagline: i.tagline,
        product: { _id: p._id, name: p.name, bank: p.bank && typeof p.bank === 'object' ? { _id: p.bank._id, name: p.bank.name } : null },
      };
    })
    .filter(Boolean);
};

exports.getAdmin = async (req, res) => {
  try {
    res.json({ items: await adminList(await ProductOfMonth.getSingleton()) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateAdmin = async (req, res) => {
  try {
    const input = req.body && req.body.items;
    if (!Array.isArray(input)) return res.status(400).json({ message: 'items must be an array' });
    if (input.length > MAX_ITEMS) return res.status(400).json({ message: `At most ${MAX_ITEMS} products` });
    const clean = [];
    const seen = new Set();
    for (const it of input) {
      if (!it || typeof it !== 'object') return res.status(400).json({ message: 'Invalid item' });
      if (!TYPES.includes(it.productType)) return res.status(400).json({ message: 'Invalid product type' });
      if (typeof it.product !== 'string' || !mongoose.isValidObjectId(it.product)) return res.status(400).json({ message: 'Invalid product id' });
      const tagline = it.tagline === undefined || it.tagline === null ? '' : it.tagline;
      if (typeof tagline !== 'string') return res.status(400).json({ message: 'Tagline must be text' });
      const t = tagline.trim();
      if (t.length > MAX_TAGLINE) return res.status(400).json({ message: `Tagline must be at most ${MAX_TAGLINE} characters` });
      const key = `${it.productType}:${it.product}`;
      if (seen.has(key)) return res.status(400).json({ message: 'Duplicate product' });
      seen.add(key);
      clean.push({ productType: it.productType, product: it.product, tagline: t });
    }
    const found = await loadProducts(clean, () => '_id');
    if (clean.some((i) => !found[`${i.productType}:${i.product}`])) return res.status(400).json({ message: 'Unknown product' });

    const doc = await ProductOfMonth.getSingleton();
    doc.items = clean;
    doc.updatedBy = req.user._id;
    await doc.save();
    res.json({ items: await adminList(doc) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getForAgent = async (req, res) => {
  try {
    const doc = await ProductOfMonth.getSingleton();
    const items = doc.items.map((i) => ({ productType: i.productType, product: i.product, tagline: i.tagline || '' }));
    const map = await loadProducts(items, (type) => AGENT_FIELDS[type]);
    const out = items
      .map((i) => {
        const p = map[`${i.productType}:${i.product}`];
        if (!p || p.isActive === false || p.agentVisible === false) return null;
        return { productType: i.productType, tagline: i.tagline, product: shapeAgentProduct(p) };
      })
      .filter(Boolean);
    res.json({ items: out });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
