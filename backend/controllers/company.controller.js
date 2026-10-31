const mongoose = require('mongoose');
const Company = require('../models/Company');

const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 1000;
const MAX_IDS = 500000;
const MAX_BULK = 5000;
// A company is listed under at most a handful of banks; this caps the rows read per lookup.
const SEARCH_ROWS_PER_NAME = 15;
const MIN_LEN = 2;
const MAX_LEN = 200;
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Trim + collapse inner whitespace. Returns '' for non-strings.
const normalizeName = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const isValidName = (n) => n.length >= MIN_LEN && n.length <= MAX_LEN;
const keyOf = (n) => n.toLowerCase();
// One row per company + bank.
const pairKey = (nameKey, bankKey) => `${nameKey}\u0000${bankKey || ''}`;
const MAX_CATEGORY = 60;
const MAX_BANK = 80;
const MAX_NOTES = 1000;
const UPDATE_FIELDS = ['category', 'notes'];
const cleanText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const cleanBank = (v) => normalizeName(v).slice(0, MAX_BANK);
// Bank, category and notes are for admin, agencies and agency staff — not agents or the public form.
const canSeeDetails = (user) => !!user && ['admin', 'agency', 'employee'].includes(user.role);
const queryOf = (req) => (typeof req.query.q === 'string' ? req.query.q : '').trim().slice(0, 60);
const listFilter = (q) => (q ? { nameKey: new RegExp(escapeRegex(keyOf(q))) } : {});

// Rows come sorted by nameKey; one entry per company with its banks. When the
// read hit its cap the last company may be cut short, so it is left out.
const groupByCompany = (docs, capped) => {
  const groups = new Map();
  for (const d of docs) {
    if (!groups.has(d.nameKey)) groups.set(d.nameKey, { _id: d._id, nameKey: d.nameKey, name: d.name, banks: [] });
    if (d.bankName || d.category || d.notes) {
      groups.get(d.nameKey).banks.push({ bankName: d.bankName || '', category: d.category || '', notes: d.notes || '' });
    }
  }
  const list = [...groups.values()];
  if (capped && list.length > 1) list.pop();
  return list;
};

// Public: autocomplete for lead forms. Nothing is listed until something is typed.
// Each company appears once; admin / agency users also get its banks.
exports.search = async (req, res) => {
  try {
    const q = queryOf(req);
    if (!q) return res.json({ items: [] });
    let limit = parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit) || limit < 1) limit = 20;
    limit = Math.min(limit, 50);

    const cap = limit * SEARCH_ROWS_PER_NAME;
    const esc = escapeRegex(keyOf(q));
    const read = async (filter) => {
      const docs = await Company.find(filter).select('_id name nameKey bankName category notes')
        .sort({ nameKey: 1, bankKey: 1 }).limit(cap).lean();
      return groupByCompany(docs, docs.length === cap);
    };
    let companies = (await read({ nameKey: new RegExp(`^${esc}`) })).slice(0, limit);
    if (companies.length < limit) {
      const contains = await read({ nameKey: { $regex: esc, $nin: companies.map((c) => c.nameKey) } });
      companies = companies.concat(contains.slice(0, limit - companies.length));
    }
    const full = canSeeDetails(req.user);
    res.json({
      items: companies.map((c) => (full ? { _id: c._id, name: c.name, banks: c.banks } : { _id: c._id, name: c.name })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const size = Math.min(Math.max(parseInt(req.query.limit, 10) || PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const filter = listFilter(queryOf(req));
    const [items, total] = await Promise.all([
      Company.find(filter).select('_id name bankName category notes createdAt').sort({ nameKey: 1, bankKey: 1 })
        .skip((page - 1) * size).limit(size).lean(),
      Company.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.max(Math.ceil(total / size), 1) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Every id matching the admin search, for "select all".
exports.ids = async (req, res) => {
  try {
    const docs = await Company.find(listFilter(queryOf(req))).select('_id').sort({ nameKey: 1, bankKey: 1 }).limit(MAX_IDS).lean();
    res.json({ ids: docs.map((d) => d._id) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Body: { rows: [{ name, bankName, category, notes }] } (or the older { names: [...] }).
// Each company + bank pair is one row. New pairs are added; a pair already in
// the list gets the category / notes given in the upload (blank cells leave
// the saved value alone).
exports.bulk = async (req, res) => {
  try {
    const body = req.body || {};
    const rows = Array.isArray(body.rows) ? body.rows
      : Array.isArray(body.names) ? body.names.map((name) => ({ name })) : null;
    if (!rows) return res.status(400).json({ message: 'rows must be an array' });
    if (rows.length > MAX_BULK) return res.status(400).json({ message: `At most ${MAX_BULK} rows per request` });

    let invalid = 0;
    let duplicates = 0;
    const unique = new Map();
    for (const row of rows) {
      const r = row || {};
      const name = normalizeName(r.name);
      if (!isValidName(name)) { invalid += 1; continue; }
      const bankName = cleanBank(r.bankName);
      const nameKey = keyOf(name);
      const bankKey = keyOf(bankName);
      const key = pairKey(nameKey, bankKey);
      if (unique.has(key)) { duplicates += 1; continue; }
      unique.set(key, {
        name,
        nameKey,
        bankName,
        bankKey,
        category: cleanText(r.category, MAX_CATEGORY),
        notes: cleanText(r.notes, MAX_NOTES),
      });
    }

    const nameKeys = [...new Set([...unique.values()].map((r) => r.nameKey))];
    const existing = nameKeys.length
      ? await Company.find({ nameKey: { $in: nameKeys } }).select('_id nameKey bankKey category notes').lean()
      : [];
    const existingByKey = new Map(existing.map((e) => [pairKey(e.nameKey, e.bankKey), e]));
    const toInsert = [];
    const updates = [];
    for (const [key, row] of unique) {
      const ex = existingByKey.get(key);
      if (!ex) { toInsert.push({ ...row, createdBy: req.user._id }); continue; }
      const set = {};
      for (const f of UPDATE_FIELDS) if (row[f] && row[f] !== (ex[f] || '')) set[f] = row[f];
      if (Object.keys(set).length) updates.push({ updateOne: { filter: { _id: ex._id }, update: { $set: set } } });
      else duplicates += 1;
    }
    if (updates.length) await Company.bulkWrite(updates);

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
    res.json({ added, updated: updates.length, duplicates, invalid });
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
    const bankName = req.body.bankName !== undefined ? cleanBank(req.body.bankName) : (doc.bankName || '');
    const bankKey = keyOf(bankName);
    const clash = await Company.findOne({ nameKey, bankKey, _id: { $ne: doc._id } }).select('_id').lean();
    if (clash) return res.status(409).json({ message: 'That company is already listed for this bank' });
    doc.name = name;
    doc.nameKey = nameKey;
    doc.bankName = bankName;
    doc.bankKey = bankKey;
    if (req.body.category !== undefined) doc.category = cleanText(req.body.category, MAX_CATEGORY);
    if (req.body.notes !== undefined) doc.notes = cleanText(req.body.notes, MAX_NOTES);
    try {
      await doc.save();
    } catch (err) {
      if (err && err.code === 11000) return res.status(409).json({ message: 'That company is already listed for this bank' });
      throw err;
    }
    res.json({
      _id: doc._id,
      name: doc.name,
      bankName: doc.bankName || '',
      category: doc.category || '',
      notes: doc.notes || '',
      createdAt: doc.createdAt,
    });
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

// Body: { ids: [...] }
exports.bulkRemove = async (req, res) => {
  try {
    const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids : null;
    if (!ids || !ids.length) return res.status(400).json({ message: 'ids must be a non-empty array' });
    if (ids.length > MAX_BULK) return res.status(400).json({ message: `At most ${MAX_BULK} companies at a time` });
    const valid = [...new Set(ids.filter((id) => mongoose.isValidObjectId(id)).map(String))];
    const { deletedCount } = valid.length ? await Company.deleteMany({ _id: { $in: valid } }) : { deletedCount: 0 };
    res.json({ deleted: deletedCount || 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports._normalizeName = normalizeName;
