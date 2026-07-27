const CardProduct = require('../models/CardProduct');
const User = require('../models/User');
const { getFilename, deleteFromS3 } = require('../middleware/upload.middleware');

const POPULATE = [
  { path: 'bank', select: 'name code isActive logo' },
  { path: 'agency', select: 'name email' },
  { path: 'cashbackCategories.category', select: 'name' },
];

const deleteCardImage = (filename) => deleteFromS3('card-images', filename);

const parseJsonField = (raw) => {
  if (!raw) return [];
  if (typeof raw === 'string') return JSON.parse(raw);
  return raw;
};

exports.list = async (req, res) => {
  try {
    const cards = await CardProduct.find().populate(POPULATE).sort({ name: 1 });
    res.json(cards);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, cardType, bank, agency, isActive } = req.body;
    if (!name || !cardType || !bank) {
      if (req.file) deleteCardImage(getFilename(req.file));
      return res.status(400).json({ message: 'name, cardType, and bank are required' });
    }
    if (agency) {
      const agencyUser = await User.findOne({ _id: agency, role: 'agency' });
      if (!agencyUser) {
        if (req.file) deleteCardImage(getFilename(req.file));
        return res.status(400).json({ message: 'Invalid agency' });
      }
    }

    const commissionBrackets = parseJsonField(req.body.commissionBrackets);
    const cashbackCategories = parseJsonField(req.body.cashbackCategories);
    const benefits = req.body.benefits || '';
    const feesEligibility = req.body.feesEligibility || '';
    const keyFeatures = req.body.keyFeatures || '';
    const clawbackMonths = req.body.clawbackMonths ? Number(req.body.clawbackMonths) : 0;
    const clawbackDays = req.body.clawbackDays ? Number(req.body.clawbackDays) : 0;
    const redirectUrl    = req.body.redirectUrl || '';
    const redirectActive = req.body.redirectActive === 'true' || req.body.redirectActive === true;
    const card = await CardProduct.create({
      name,
      cardType,
      bank,
      agency: agency || undefined,
      commissionBrackets,
      cashbackCategories,
      benefits,
      feesEligibility,
      keyFeatures,
      clawbackMonths,
      clawbackDays,
      isActive: isActive === undefined ? true : isActive !== 'false' && isActive !== false,
      cardImage: req.file ? getFilename(req.file) : undefined,
      redirectUrl,
      redirectActive,
    });
    const populated = await card.populate(POPULATE);
    res.status(201).json(populated);
  } catch (err) {
    if (req.file) deleteCardImage(getFilename(req.file));
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, cardType, bank, agency, isActive } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (cardType !== undefined) update.cardType = cardType;
    if (bank !== undefined) update.bank = bank;
    if (agency !== undefined) {
      const agencyUser = await User.findOne({ _id: agency, role: 'agency' });
      if (!agencyUser) {
        if (req.file) deleteCardImage(getFilename(req.file));
        return res.status(400).json({ message: 'Invalid agency' });
      }
      update.agency = agency;
    }
    if (req.body.commissionBrackets !== undefined) {
      update.commissionBrackets = parseJsonField(req.body.commissionBrackets);
    }
    if (req.body.cashbackCategories !== undefined) {
      update.cashbackCategories = parseJsonField(req.body.cashbackCategories);
    }
    if (req.body.benefits !== undefined) update.benefits = req.body.benefits || '';
    if (req.body.feesEligibility !== undefined) update.feesEligibility = req.body.feesEligibility || '';
    if (req.body.keyFeatures !== undefined) update.keyFeatures = req.body.keyFeatures || '';
    if (req.body.clawbackMonths !== undefined) update.clawbackMonths = Number(req.body.clawbackMonths) || 0;
    if (req.body.clawbackDays !== undefined) update.clawbackDays = Number(req.body.clawbackDays) || 0;
    if (isActive !== undefined) update.isActive = isActive !== 'false' && isActive !== false;
    if (req.body.redirectUrl !== undefined) update.redirectUrl = req.body.redirectUrl || '';
    if (req.body.redirectActive !== undefined) update.redirectActive = req.body.redirectActive === 'true' || req.body.redirectActive === true;

    if (req.file) {
      const existing = await CardProduct.findById(req.params.id, 'cardImage');
      if (existing?.cardImage) deleteCardImage(existing.cardImage);
      update.cardImage = getFilename(req.file);
    }

    const card = await CardProduct.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate(POPULATE);
    if (!card) {
      if (req.file) deleteCardImage(getFilename(req.file));
      return res.status(404).json({ message: 'Card product not found' });
    }
    res.json(card);
  } catch (err) {
    if (req.file) deleteCardImage(getFilename(req.file));
    res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const card = await CardProduct.findByIdAndDelete(req.params.id);
    if (!card) return res.status(404).json({ message: 'Card product not found' });
    if (card.cardImage) deleteCardImage(card.cardImage);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/card-products/auto-tag-cashback  (admin)
 * Finds all cards where any text field contains "cashback" and adds the Cashback category if missing.
 */
exports.autoTagCashback = async (req, res) => {
  try {
    const CardCategory = require('../models/CardCategory');
    const cashbackCat = await CardCategory.findOne({ name: /^cashback$/i });
    if (!cashbackCat) return res.status(404).json({ message: 'Cashback category not found. Create it first.' });

    const cards = await CardProduct.find();
    let updated = 0;
    for (const card of cards) {
      const already = card.cashbackCategories.some(c => String(c.category) === String(cashbackCat._id));
      if (already) continue;
      const blob = [card.name, card.benefits, card.feesEligibility, card.keyFeatures].join(' ').toLowerCase();
      if (blob.includes('cashback')) {
        card.cashbackCategories.push({ category: cashbackCat._id, rate: null });
        await card.save();
        updated++;
      }
    }
    res.json({ updated, total: cards.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
