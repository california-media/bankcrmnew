const fs = require('fs');
const path = require('path');
const CardProduct = require('../models/CardProduct');
const User = require('../models/User');

const POPULATE = [
  { path: 'bank', select: 'name code' },
  { path: 'agency', select: 'name email' },
];

const deleteCardImage = (filename) => {
  if (!filename) return;
  fs.unlink(path.join(__dirname, `../uploads/card-images/${filename}`), () => {});
};

const parseBrackets = (raw) => {
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
      if (req.file) deleteCardImage(req.file.filename);
      return res.status(400).json({ message: 'name, cardType, and bank are required' });
    }
    if (agency) {
      const agencyUser = await User.findOne({ _id: agency, role: 'agency' });
      if (!agencyUser) {
        if (req.file) deleteCardImage(req.file.filename);
        return res.status(400).json({ message: 'Invalid agency' });
      }
    }

    const commissionBrackets = parseBrackets(req.body.commissionBrackets);
    const card = await CardProduct.create({
      name,
      cardType,
      bank,
      agency: agency || undefined,
      commissionBrackets,
      isActive: isActive === undefined ? true : isActive !== 'false' && isActive !== false,
      cardImage: req.file ? req.file.filename : undefined,
    });
    const populated = await card.populate(POPULATE);
    res.status(201).json(populated);
  } catch (err) {
    if (req.file) deleteCardImage(req.file.filename);
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
        if (req.file) deleteCardImage(req.file.filename);
        return res.status(400).json({ message: 'Invalid agency' });
      }
      update.agency = agency;
    }
    if (req.body.commissionBrackets !== undefined) {
      update.commissionBrackets = parseBrackets(req.body.commissionBrackets);
    }
    if (isActive !== undefined) update.isActive = isActive !== 'false' && isActive !== false;

    if (req.file) {
      const existing = await CardProduct.findById(req.params.id, 'cardImage');
      if (existing?.cardImage) deleteCardImage(existing.cardImage);
      update.cardImage = req.file.filename;
    }

    const card = await CardProduct.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate(POPULATE);
    if (!card) {
      if (req.file) deleteCardImage(req.file.filename);
      return res.status(404).json({ message: 'Card product not found' });
    }
    res.json(card);
  } catch (err) {
    if (req.file) deleteCardImage(req.file.filename);
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
