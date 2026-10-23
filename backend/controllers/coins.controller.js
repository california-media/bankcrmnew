const mongoose = require('mongoose');
const coins = require('../services/coins.service');
const CoinSettings = require('../models/CoinSettings');
const SpinLog = require('../models/SpinLog');
const CoinTransaction = require('../models/CoinTransaction');
const Voucher = require('../models/Voucher');
const VoucherCode = require('../models/VoucherCode');
const Redemption = require('../models/Redemption');
const User = require('../models/User');
const { dubaiDayKey, nextDubaiMidnight, chancePcts } = require('../utils/coins');
const { maskName, shapeVoucher, shapeRedemption } = require('../utils/coinsShape');

const PAGE_SIZE = 20;
const fail = (res, err) => res.status(err.status || 500).json({ message: err.message });

// One aggregate -> Map(voucherId string -> available code count)
const stockMap = async (voucherIds) => {
  const rows = await VoucherCode.aggregate([
    { $match: { status: 'available', voucher: { $in: voucherIds } } },
    { $group: { _id: '$voucher', n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('coinBalance');
    res.json({ balance: user?.coinBalance || 0 });
  } catch (err) { fail(res, err); }
};

exports.getSpin = async (req, res) => {
  try {
    const now = new Date();
    const [settings, log] = await Promise.all([
      CoinSettings.getSingleton(),
      SpinLog.findOne({ user: req.user._id, dayKey: dubaiDayKey(now) }),
    ]);
    const pcts = chancePcts(settings.spinSegments);
    res.json({
      enabled: settings.spinEnabled,
      segments: settings.spinSegments.map((s, i) => ({ coins: s.coins, chancePct: pcts[i] })),
      spunToday: !!log,
      today: log ? { segmentIndex: log.segmentIndex, coins: log.coins } : null,
      nextResetAt: nextDubaiMidnight(now).toISOString(),
    });
  } catch (err) { fail(res, err); }
};

exports.postSpin = async (req, res) => {
  try {
    const { segmentIndex, coins: won, balance } = await coins.spin(req.user._id);
    res.json({ segmentIndex, coins: won, balance });
  } catch (err) { fail(res, err); }
};

exports.transactions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const rows = await CoinTransaction.find({ user: req.user._id })
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE + 1)
      .lean();
    res.json({
      items: rows.slice(0, PAGE_SIZE).map((t) => ({
        _id: t._id, type: t.type, amount: t.amount, balanceAfter: t.balanceAfter,
        title: t.title, createdAt: t.createdAt,
      })),
      page,
      hasMore: rows.length > PAGE_SIZE,
    });
  } catch (err) { fail(res, err); }
};

exports.vouchers = async (req, res) => {
  try {
    const list = await Voucher.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
    const stock = await stockMap(list.map((v) => v._id));
    res.json(list.map((v) => shapeVoucher(v, stock.get(String(v._id)))));
  } catch (err) { fail(res, err); }
};

exports.redeem = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Voucher not found' });
    const { redemption, balance } = await coins.redeem(req.user._id, req.params.id);
    const voucher = await Voucher.findById(redemption.voucher).lean();
    const stock = await stockMap([redemption.voucher]);
    res.json({ redemption: shapeRedemption(redemption, voucher, stock.get(String(redemption.voucher))), balance });
  } catch (err) { fail(res, err); }
};

exports.redemptions = async (req, res) => {
  try {
    const rows = await Redemption.find({ user: req.user._id }).sort({ createdAt: -1, _id: -1 }).lean();
    const ids = [...new Set(rows.map((r) => String(r.voucher)))].map((id) => new mongoose.Types.ObjectId(id));
    const [vouchers, stock] = await Promise.all([Voucher.find({ _id: { $in: ids } }).lean(), stockMap(ids)]);
    const byId = new Map(vouchers.map((v) => [String(v._id), v]));
    res.json(rows.map((r) => shapeRedemption(r, byId.get(String(r.voucher)), stock.get(String(r.voucher)))));
  } catch (err) { fail(res, err); }
};

exports.scratch = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ message: 'Redemption not found' });
    const owned = await Redemption.findOne({ _id: id, user: req.user._id });
    if (!owned) return res.status(404).json({ message: 'Redemption not found' });
    // Only set when still null; a lost race just means it was already scratched.
    await Redemption.updateOne({ _id: id, user: req.user._id, scratchedAt: null }, { $set: { scratchedAt: new Date() } });
    const fresh = await Redemption.findById(id).select('scratchedAt').lean();
    res.json({ _id: fresh._id, scratchedAt: fresh.scratchedAt });
  } catch (err) { fail(res, err); }
};

exports.invites = async (req, res) => {
  try {
    const [settings, me, users] = await Promise.all([
      CoinSettings.getSingleton(),
      User.findById(req.user._id).select('referralCode'),
      User.find({ referredBy: req.user._id }).select('name isActive createdAt').sort({ createdAt: -1 }).lean(),
    ]);
    const txs = users.length
      ? await CoinTransaction.find({ user: req.user._id, type: 'invite', invitee: { $in: users.map((u) => u._id) } })
          .select('invitee amount').lean()
      : [];
    const earned = new Map(txs.map((t) => [String(t.invitee), t.amount]));
    res.json({
      code: me?.referralCode || null,
      enabled: settings.inviteEnabled,
      reward: settings.inviteReward,
      invites: users.map((u) => ({
        name: maskName(u.name),
        joinedAt: u.createdAt,
        status: u.isActive ? 'active' : 'pending_verification',
        coinsEarned: earned.get(String(u._id)) || 0,
      })),
    });
  } catch (err) { fail(res, err); }
};
