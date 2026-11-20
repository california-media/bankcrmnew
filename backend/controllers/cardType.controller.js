const CardType = require('../models/CardType');
const CardProduct = require('../models/CardProduct');
const { clearPublicCardCache, notifyWebsiteProductsChanged } = require('../utils/publicCardCache');

// The fixed list before types became editable. Keys stay: the app and the
// website match on them (e.g. 'premium', 'travel', 'islamic').
const DEFAULT_TYPES = [
  ['regular', 'Regular'],
  ['premium', 'Premium'],
  ['rewards_lifestyle', 'Rewards & Lifestyle'],
  ['cashback', 'Cashback'],
  ['islamic', 'Islamic'],
  ['travel', 'Travel'],
  ['ecommerce', 'E-Commerce'],
  ['legacy', 'Legacy'],
];

const MAX_LABEL_LEN = 40;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const slugify = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const labelFromKey = (key) => key.split('_').filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') || key;

function cleanLabel(body) {
  const label = String(body?.label ?? '').trim().replace(/\s+/g, ' ');
  if (!label) return { error: 'Name required' };
  if (label.length > MAX_LABEL_LEN) return { error: `Name must be ${MAX_LABEL_LEN} characters or less` };
  return { label };
}

const labelTaken = (label, exceptId) => CardType.exists({
  label: new RegExp(`^${escapeRegex(label)}$`, 'i'),
  ...(exceptId ? { _id: { $ne: exceptId } } : {}),
});

async function uniqueKey(label) {
  const base = slugify(label) || 'type';
  let key = base;
  for (let n = 2; await CardType.exists({ key }); n++) key = `${base}_${n}`;
  return key;
}

async function nextOrder() {
  const last = await CardType.findOne().sort({ order: -1 }).select('order').lean();
  return (last?.order || 0) + 1;
}

async function insertIgnoringDuplicates(docs) {
  try {
    await CardType.insertMany(docs, { ordered: false });
  } catch (err) {
    if (err.code !== 11000 && !err.writeErrors?.every((e) => e.code === 11000)) throw err; // another request added them first
  }
}

async function ensureDefaults() {
  if (await CardType.exists({})) return;
  await insertIgnoringDuplicates(DEFAULT_TYPES.map(([key, label], i) => ({ key, label, order: i + 1 })));
}

// Cards saved before multi-type (or by import scripts) only have cardType.
async function backfillCards() {
  const cards = await CardProduct.find(
    { cardType: { $nin: [null, ''] }, $or: [{ cardTypes: { $exists: false } }, { cardTypes: { $size: 0 } }] },
    'cardType'
  ).lean();
  if (!cards.length) return;
  await CardProduct.bulkWrite(cards.map((c) => ({
    updateOne: { filter: { _id: c._id }, update: { $set: { cardTypes: [c.cardType] } } },
  })));
}

// The list always holds every type that is on a card, so no card shows an unknown key.
async function addMissingFromCards() {
  const used = await CardProduct.distinct('cardTypes');
  const known = new Set((await CardType.find().select('key').lean()).map((t) => t.key));
  const missing = used.filter((k) => k && !known.has(k));
  if (!missing.length) return;
  const order = await nextOrder();
  await insertIgnoringDuplicates(missing.map((key, i) => ({ key, label: labelFromKey(key).slice(0, MAX_LABEL_LEN), order: order + i })));
}

// key -> number of cards using it
async function cardCounts() {
  const rows = await CardProduct.aggregate([
    { $unwind: '$cardTypes' },
    { $group: { _id: '$cardTypes', cards: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.cards]));
}

const sorted = () => CardType.find().sort({ order: 1, label: 1 });

function cardsChanged() {
  clearPublicCardCache();
  notifyWebsiteProductsChanged();
}

exports.list = async (req, res) => {
  try {
    await ensureDefaults();
    await backfillCards();
    await addMissingFromCards();
    const [types, counts] = await Promise.all([sorted().lean(), cardCounts()]);
    res.json(types.map((t) => ({ ...t, cards: counts.get(t.key) || 0 })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Labels for pages that show a card's type (agents, referral form, track status).
exports.listPublic = async (req, res) => {
  try {
    await ensureDefaults();
    res.json(await sorted().select('key label -_id').lean());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const input = cleanLabel(req.body);
    if (input.error) return res.status(400).json({ message: input.error });
    if (await labelTaken(input.label)) return res.status(400).json({ message: 'This card type already exists' });
    const type = await CardType.create({ key: await uniqueKey(input.label), label: input.label, order: await nextOrder() });
    res.status(201).json({ ...type.toObject(), cards: 0 });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'This card type already exists' });
    res.status(400).json({ message: err.message });
  }
};

// Renames only: cards keep the key, so nothing on them changes.
exports.update = async (req, res) => {
  try {
    const input = cleanLabel(req.body);
    if (input.error) return res.status(400).json({ message: input.error });
    const type = await CardType.findById(req.params.id);
    if (!type) return res.status(404).json({ message: 'Card type not found' });
    if (await labelTaken(input.label, type._id)) return res.status(400).json({ message: 'This card type already exists' });
    type.label = input.label;
    await type.save();
    const cards = await CardProduct.countDocuments({ cardTypes: type.key });
    res.json({ ...type.toObject(), cards });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Removes the type from every card using it. Refused while a card has no other type.
exports.remove = async (req, res) => {
  try {
    const type = await CardType.findById(req.params.id);
    if (!type) return res.status(404).json({ message: 'Card type not found' });
    const { key } = type;
    await backfillCards();

    const onlyType = await CardProduct.find({ cardTypes: { $size: 1, $all: [key] } }).select('name').sort({ name: 1 }).lean();
    if (onlyType.length) {
      const names = onlyType.slice(0, 5).map((c) => c.name).join(', ') + (onlyType.length > 5 ? ` and ${onlyType.length - 5} more` : '');
      return res.status(400).json({
        message: `"${type.label}" is the only type on ${onlyType.length} card${onlyType.length !== 1 ? 's' : ''}: ${names}. Give ${onlyType.length !== 1 ? 'them' : 'it'} another type first.`,
        onlyTypeCards: onlyType.length,
      });
    }

    const r = await CardProduct.updateMany({ cardTypes: key }, { $pull: { cardTypes: key } });
    const lostMain = await CardProduct.find({ cardType: key }).select('cardTypes').lean();
    if (lostMain.length) {
      await CardProduct.bulkWrite(lostMain.map((c) => ({
        updateOne: { filter: { _id: c._id }, update: { $set: { cardType: c.cardTypes[0] } } },
      })));
    }
    await type.deleteOne();
    if (r.modifiedCount) cardsChanged();
    res.json({ message: 'Deleted', key, updatedCards: r.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// For the card product controller: deduped keys, all in the list, at least one.
exports.cleanCardTypes = async (raw) => {
  let list = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw); } catch { list = [raw]; }
  }
  if (!Array.isArray(list)) list = [list];
  const keys = [...new Set(list.map((k) => String(k ?? '').trim()).filter(Boolean))];
  if (!keys.length) return { error: 'Pick at least one card type' };
  await ensureDefaults();
  const found = await CardType.countDocuments({ key: { $in: keys } });
  if (found !== keys.length) return { error: 'Unknown card type — refresh the page and pick again' };
  return { cardTypes: keys };
};
