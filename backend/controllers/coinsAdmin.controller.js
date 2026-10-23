const mongoose = require('mongoose');
const XLSX = require('xlsx');
const CoinSettings = require('../models/CoinSettings');
const Voucher = require('../models/Voucher');
const VoucherCode = require('../models/VoucherCode');
const Redemption = require('../models/Redemption');
const User = require('../models/User');
const { validateSpinSegments, validateInviteReward, chancePcts, parseVoucherCodes } = require('../utils/coins');
const { logoUrl } = require('../utils/coinsShape');
const { getFilename, deleteFromS3 } = require('../middleware/upload.middleware');

const PAGE_SIZE = 50;
const THEMES = ['shop', 'dine', 'cine', 'trav', 'coff', 'fuel'];
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toBool = (v) => v === true || v === 'true' || v === '1' || v === 'on';

const shapeSettings = (s) => {
  const pcts = chancePcts(s.spinSegments);
  return {
    spinEnabled: s.spinEnabled,
    spinSegments: s.spinSegments.map((seg, i) => ({ coins: seg.coins, weight: seg.weight, chancePct: pcts[i] })),
    inviteEnabled: s.inviteEnabled,
    inviteReward: s.inviteReward,
    updatedAt: s.updatedAt,
  };
};

const adminVoucher = (v, counts = {}) => ({
  ...v.toObject(),
  logoUrl: logoUrl(v.logo),
  available: counts.available || 0,
  assigned: counts.assigned || 0,
});

exports.getSettings = async (req, res) => {
  try {
    res.json(shapeSettings(await CoinSettings.getSingleton()));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { spinEnabled, spinSegments, inviteEnabled, inviteReward } = req.body || {};
    const segErr = validateSpinSegments(spinSegments);
    if (segErr) return res.status(400).json({ message: segErr });
    const rewardErr = validateInviteReward(inviteReward);
    if (rewardErr) return res.status(400).json({ message: rewardErr });

    const s = await CoinSettings.getSingleton();
    s.spinEnabled = !!spinEnabled;
    s.spinSegments = spinSegments.map((x) => ({ coins: x.coins, weight: x.weight }));
    s.inviteEnabled = !!inviteEnabled;
    s.inviteReward = inviteReward;
    s.updatedBy = req.user._id;
    await s.save();
    res.json(shapeSettings(s));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.listVouchers = async (req, res) => {
  try {
    const [vouchers, grouped] = await Promise.all([
      Voucher.find().sort({ sortOrder: 1, createdAt: -1 }),
      VoucherCode.aggregate([{ $group: { _id: { voucher: '$voucher', status: '$status' }, n: { $sum: 1 } } }]),
    ]);
    const counts = {};
    for (const g of grouped) {
      const key = String(g._id.voucher);
      counts[key] = counts[key] || {};
      counts[key][g._id.status] = g.n;
    }
    res.json(vouchers.map((v) => adminVoucher(v, counts[String(v._id)])));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Reads Voucher fields from a multipart body; returns { data } or { error }.
const readVoucherFields = (body, { partial }) => {
  const data = {};
  const str = ['title', 'brand', 'category', 'description', 'terms', 'valueLabel'];
  for (const k of str) if (body[k] !== undefined) data[k] = String(body[k]).trim();
  if (!partial && !data.title) return { error: 'Title is required' };
  if (partial && data.title === '') return { error: 'Title is required' };
  if (body.coinCost !== undefined || !partial) {
    const cost = Number(body.coinCost);
    if (!Number.isInteger(cost) || cost < 1) return { error: 'Coin cost must be a whole number of 1 or more' };
    data.coinCost = cost;
  }
  if (body.theme !== undefined) {
    if (!THEMES.includes(body.theme)) return { error: 'Invalid theme' };
    data.theme = body.theme;
  }
  if (body.validUntil !== undefined) {
    if (body.validUntil === '' || body.validUntil === 'null') data.validUntil = null;
    else {
      const d = new Date(body.validUntil);
      if (Number.isNaN(d.getTime())) return { error: 'Invalid valid until date' };
      data.validUntil = d;
    }
  }
  if (body.isActive !== undefined) data.isActive = toBool(body.isActive);
  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (!Number.isFinite(n)) return { error: 'Sort order must be a number' };
    data.sortOrder = n;
  }
  return { data };
};

exports.createVoucher = async (req, res) => {
  try {
    const { data, error } = readVoucherFields(req.body || {}, { partial: false });
    if (error) {
      if (req.file) deleteFromS3('voucher-logos', getFilename(req.file));
      return res.status(400).json({ message: error });
    }
    if (req.file) data.logo = getFilename(req.file);
    const v = await Voucher.create(data);
    res.status(201).json(adminVoucher(v));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateVoucher = async (req, res) => {
  try {
    const cleanup = () => { if (req.file) deleteFromS3('voucher-logos', getFilename(req.file)); };
    if (!mongoose.isValidObjectId(req.params.id)) { cleanup(); return res.status(404).json({ message: 'Voucher not found' }); }
    const v = await Voucher.findById(req.params.id);
    if (!v) { cleanup(); return res.status(404).json({ message: 'Voucher not found' }); }
    const { data, error } = readVoucherFields(req.body || {}, { partial: true });
    if (error) { cleanup(); return res.status(400).json({ message: error }); }
    const oldLogo = v.logo;
    v.set(data);
    if (req.file) v.logo = getFilename(req.file);
    await v.save();
    if (req.file && oldLogo) deleteFromS3('voucher-logos', oldLogo);
    const [available, assigned] = await Promise.all([
      VoucherCode.countDocuments({ voucher: v._id, status: 'available' }),
      VoucherCode.countDocuments({ voucher: v._id, status: 'assigned' }),
    ]);
    res.json(adminVoucher(v, { available, assigned }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteVoucher = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Voucher not found' });
    const v = await Voucher.findById(req.params.id);
    if (!v) return res.status(404).json({ message: 'Voucher not found' });
    if (await VoucherCode.exists({ voucher: v._id, status: 'assigned' })) {
      return res.status(409).json({ message: 'This voucher has been redeemed. Deactivate it instead.' });
    }
    await VoucherCode.deleteMany({ voucher: v._id });
    await v.deleteOne();
    try { deleteFromS3('voucher-logos', v.logo); } catch (e) { console.error('voucher logo delete failed', e.message); }
    res.json({ message: 'Voucher deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const textFromSheet = (buffer) => {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return '';
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  return rows.map((r) => String(r[0] ?? '').trim()).filter(Boolean).join('\n');
};

exports.addCodes = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Voucher not found' });
    const v = await Voucher.findById(req.params.id).select('_id');
    if (!v) return res.status(404).json({ message: 'Voucher not found' });

    let text = '';
    if (req.file) {
      try { text = textFromSheet(req.file.buffer); }
      catch { return res.status(400).json({ message: 'Could not read the spreadsheet' }); }
    } else {
      text = (req.body && req.body.text) || '';
    }

    // Raw non-empty lines vs unique valid codes: in-submission duplicates count as skipped.
    const rawCount = String(text).split('\n').filter((l) => l.trim()).length;
    const codes = parseVoucherCodes(text);
    if (codes.length === 0) return res.status(400).json({ message: 'No codes found' });

    const existing = await VoucherCode.find({ voucher: v._id, code: { $in: codes } }).select('code').lean();
    const have = new Set(existing.map((e) => e.code));
    const fresh = codes.filter((c) => !have.has(c));

    let added = fresh.length;
    if (fresh.length) {
      try {
        await VoucherCode.insertMany(fresh.map((code) => ({ voucher: v._id, code })), { ordered: false });
      } catch (err) {
        // Race with a concurrent import: duplicate-key failures are reported per document.
        const failed = Array.isArray(err.writeErrors) ? err.writeErrors.length : null;
        if (failed === null) throw err;
        added = fresh.length - failed;
      }
    }
    res.json({ added, skipped: rawCount - added });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const dayStart = (s) => (/^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(`${String(s).slice(0, 10)}T00:00:00.000Z`) : new Date(s));

exports.listRedemptions = async (req, res) => {
  try {
    const { from, to, voucher, agent } = req.query;
    let page = parseInt(req.query.page, 10);
    if (!Number.isFinite(page)) page = 1;
    page = Math.min(100000, Math.max(1, page));

    const filter = {};
    const range = {};
    if (from) {
      const d = dayStart(from);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ message: 'Invalid from date' });
      range.$gte = d;
    }
    if (to) {
      const d = dayStart(to);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ message: 'Invalid to date' });
      range.$lt = new Date(d.getTime() + 24 * 60 * 60 * 1000);
    }
    if (range.$gte || range.$lt) filter.createdAt = range;

    if (voucher) {
      if (!mongoose.isValidObjectId(voucher)) return res.json({ items: [], page, hasMore: false });
      filter.voucher = voucher;
    }
    if (agent && String(agent).trim()) {
      const rx = new RegExp(escapeRegex(String(agent).trim()), 'i');
      const users = await User.find({ $or: [{ name: rx }, { email: rx }] }).select('_id').lean();
      filter.user = { $in: users.map((u) => u._id) };
    }

    const rows = await Redemption.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE + 1)
      .populate('user', 'name email')
      .populate('voucher', 'title')
      .lean();
    const hasMore = rows.length > PAGE_SIZE;
    const items = rows.slice(0, PAGE_SIZE).map((r) => ({
      _id: r._id,
      createdAt: r.createdAt,
      coinCost: r.coinCost,
      code: r.code,
      scratchedAt: r.scratchedAt,
      user: r.user ? { name: r.user.name, email: r.user.email } : null,
      voucher: r.voucher ? { title: r.voucher.title } : null,
    }));
    res.json({ items, page, hasMore });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
