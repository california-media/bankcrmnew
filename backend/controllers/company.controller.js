const mongoose = require('mongoose');
const Company = require('../models/Company');

const PAGE_SIZE = 50;
const MAX_BULK = 5000;
const MIN_LEN = 2;
const MAX_LEN = 120;
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Trim + collapse inner whitespace. Returns '' for non-strings.
const normalizeName = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const isValidName = (n) => n.length >= MIN_LEN && n.length <= MAX_LEN;
const keyOf = (n) => n.toLowerCase();

// Public: autocomplete for lead forms.
exports.search = async (req, res) => {
  try {
    const q = (typeof req.query.q === 'string' ? req.query.q : '').trim().slice(0, 60);
    let limit = parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit) || limit < 1) limit = 20;
    limit = Math.min(limit, 50);

    let docs;
    if (!q) {
      docs = await Company.find().select('_id name').sort({ nameKey: 1 }).limit(limit).lean();
    } else {
      const esc = escapeRegex(q);
      const starts = await Company.find({ name: new RegExp(`^${esc}`, 'i') }).select('_id name').sort({ nameKey: 1 }).limit(limit).lean();
      docs = starts;
      if (starts.length < limit) {
        const contains = await Company.find({
          name: new RegExp(esc, 'i'),
          _id: { $nin: starts.map((d) => d._id) },
        }).select('_id name').sort({ nameKey: 1 }).limit(limit - starts.length).lean();
        docs = starts.concat(contains);
      }
    }
    res.json({ items: docs.map((d) => ({ _id: d._id, name: d.name })) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    const q = (typeof req.query.q === 'string' ? req.query.q : '').trim().slice(0, 60);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const filter = q ? { name: new RegExp(escapeRegex(q), 'i') } : {};
    const [items, total] = await Promise.all([
      Company.find(filter).select('_id name createdAt').sort({ nameKey: 1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
      Company.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.max(Math.ceil(total / PAGE_SIZE), 1) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.bulk = async (req, res) => {
  try {
    const names = req.body && req.body.names;
    if (!Array.isArray(names)) return res.status(400).json({ message: 'names must be an array' });
    if (names.length > MAX_BULK) return res.status(400).json({ message: `At most ${MAX_BULK} names per upload` });

    let invalid = 0;
    let duplicates = 0;
    const unique = new Map();
    for (const raw of names) {
      const name = normalizeName(raw);
      if (!isValidName(name)) { invalid += 1; continue; }
      const key = keyOf(name);
      if (unique.has(key)) { duplicates += 1; continue; }
      unique.set(key, name);
    }

    const keys = [...unique.keys()];
    const existing = keys.length ? await Company.find({ nameKey: { $in: keys } }).select('nameKey').lean() : [];
    const existingKeys = new Set(existing.map((e) => e.nameKey));
    const toInsert = [];
    for (const [key, name] of unique) {
      if (existingKeys.has(key)) duplicates += 1;
      else toInsert.push({ name, nameKey: key, createdBy: req.user._id });
    }

    let added = 0;
    if (toInsert.length) {
      try {
        const docs = await Company.insertMany(toInsert, { ordered: false });
        added = docs.length;
      } catch (err) {
        // Race with another upload: tolerate E11000 duplicates, rethrow anything else.
        const errs = Array.isArray(err.writeErrors) ? err.writeErrors : [];
        const dupCount = errs.filter((w) => (w.code || (w.err && w.err.code)) === 11000).length;
        if (!errs.length || dupCount !== errs.length) throw err;
        added = toInsert.length - dupCount;
        duplicates += dupCount;
      }
    }
    res.json({ added, duplicates, invalid });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Company not found' });
    const name = normalizeName(req.body && req.body.name);
    if (!isValidName(name)) return res.status(400).json({ message: `Name must be ${MIN_LEN}-${MAX_LEN} characters` });
    const doc = await Company.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Company not found' });
    const nameKey = keyOf(name);
    const clash = await Company.findOne({ nameKey, _id: { $ne: doc._id } }).select('_id').lean();
    if (clash) return res.status(409).json({ message: 'That company is already in the list' });
    doc.name = name;
    doc.nameKey = nameKey;
    try {
      await doc.save();
    } catch (err) {
      if (err && err.code === 11000) return res.status(409).json({ message: 'That company is already in the list' });
      throw err;
    }
    res.json({ _id: doc._id, name: doc.name, createdAt: doc.createdAt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Company not found' });
    const doc = await Company.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Company not found' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports._normalizeName = normalizeName;
