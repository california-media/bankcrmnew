const crypto = require('crypto');
const { dubaiDayKey, pickSegmentIndex } = require('../utils/coins');

const httpError = (status, message) => Object.assign(new Error(message), { status });
const isDup = (err) => err && err.code === 11000;
const firstName = (name) => (String(name || '').trim().split(/\s+/)[0] || 'a partner');

// No Mongo transactions: every money move is a guarded atomic update, ordered so
// a failure at any step never loses coins or hands one code to two agents.
function makeCoinsService(deps) {
  const { User, CoinTransaction, SpinLog, Voucher, VoucherCode, Redemption, CoinSettings, notify, randInt, now } = deps;

  async function spin(userId) {
    const settings = await CoinSettings.getSingleton();
    if (!settings.spinEnabled) throw httpError(400, 'Spin & Win is not available right now');
    const segs = settings.spinSegments;
    const i = pickSegmentIndex(segs, randInt);
    const coins = segs[i].coins;
    let log;
    try {
      log = await SpinLog.create({
        user: userId,
        dayKey: dubaiDayKey(now()),
        segmentIndex: i,
        coins,
        segmentsSnapshot: segs.map((s) => ({ coins: s.coins, weight: s.weight })),
      });
    } catch (err) {
      if (isDup(err)) throw httpError(409, "You've already spun today");
      throw err;
    }
    let u;
    try {
      u = await User.findOneAndUpdate({ _id: userId, role: 'agent' }, { $inc: { coinBalance: coins } }, { new: true });
      if (!u) throw httpError(404, 'User not found');
    } catch (err) {
      // Not credited: free the day's spin so the agent can retry.
      await SpinLog.deleteOne({ _id: log._id }).catch((e) => console.error('spin rollback failed', e));
      throw err;
    }
    try {
      await CoinTransaction.create({
        user: userId, type: 'spin', amount: coins, balanceAfter: u.coinBalance, title: 'Daily spin', spin: log._id,
      });
    } catch (err) {
      console.error('spin ledger write failed (balance already credited)', err); // coins are safe; only history is missing
    }
    return { segmentIndex: i, coins, balance: u.coinBalance };
  }

  async function redeem(userId, voucherId) {
    const voucher = await Voucher.findOne({ _id: voucherId, isActive: true });
    if (!voucher) throw httpError(404, 'Voucher not found');
    const cost = voucher.coinCost;

    // 1. Claim a code atomically: two requests can never get the same one.
    const code = await VoucherCode.findOneAndUpdate(
      { voucher: voucher._id, status: 'available' },
      { $set: { status: 'assigned', assignedTo: userId, assignedAt: now() } },
      { new: true }
    );
    if (!code) throw httpError(409, 'Out of stock');

    const release = () =>
      VoucherCode.updateOne({ _id: code._id }, { $set: { status: 'available' }, $unset: { assignedTo: 1, assignedAt: 1 } });

    // 2. Guarded debit: the $gte filter is what prevents a negative balance.
    let u;
    try {
      u = await User.findOneAndUpdate(
        { _id: userId, role: 'agent', coinBalance: { $gte: cost } },
        { $inc: { coinBalance: -cost } },
        { new: true }
      );
    } catch (err) {
      await release().catch((e) => console.error('code release failed', e));
      throw err;
    }
    if (!u) {
      await release();
      throw httpError(400, 'Not enough coins');
    }

    // 3. Record. If the redemption cannot be written, undo debit and claim.
    let r;
    try {
      r = await Redemption.create({
        user: userId, voucher: voucher._id, voucherCode: code._id, code: code.code, coinCost: cost, scratchedAt: null,
      });
    } catch (err) {
      await User.findOneAndUpdate({ _id: userId }, { $inc: { coinBalance: cost } }).catch((e) => console.error('refund failed', e));
      await release().catch((e) => console.error('code release failed', e));
      throw err;
    }
    // Charged and code held by now; ledger/back-link failures must not fail the request.
    try {
      await CoinTransaction.create({
        user: userId, type: 'redeem', amount: -cost, balanceAfter: u.coinBalance, title: `${voucher.title} redeemed`, redemption: r._id,
      });
    } catch (err) {
      console.error('redeem ledger write failed', err);
    }
    try {
      await VoucherCode.updateOne({ _id: code._id }, { $set: { redemption: r._id } });
    } catch (err) {
      console.error('redeem code back-link failed', err);
    }
    return { redemption: r, balance: u.coinBalance };
  }

  async function awardInvite(invitee) {
    try {
      if (!invitee || !invitee.referredBy) return;
      const settings = await CoinSettings.getSingleton();
      const reward = settings.inviteReward;
      if (!settings.inviteEnabled || !(reward > 0)) return;
      const inviter = await User.findOne({ _id: invitee.referredBy, role: 'agent', isActive: true });
      if (!inviter) return;

      const name = firstName(invitee.name);
      // Ledger row first: its unique {invitee} index is the once-only guard.
      let tx;
      try {
        tx = await CoinTransaction.create({
          user: inviter._id, type: 'invite', invitee: invitee._id, amount: reward, balanceAfter: 0, title: `Invite bonus · ${name}`,
        });
      } catch (err) {
        if (isDup(err)) return; // already paid
        throw err;
      }
      let u;
      try {
        u = await User.findOneAndUpdate({ _id: inviter._id }, { $inc: { coinBalance: reward } }, { new: true });
        if (!u) throw new Error('inviter vanished');
      } catch (err) {
        // Not credited: drop the guard row so a later retry can still pay.
        await CoinTransaction.deleteOne({ _id: tx._id }).catch((e) => console.error('invite rollback failed', e));
        throw err;
      }
      await CoinTransaction.updateOne({ _id: tx._id }, { $set: { balanceAfter: u.coinBalance } })
        .catch((e) => console.error('invite balanceAfter update failed', e));
      await notify([inviter._id], {
        type: 'coins_awarded',
        title: 'Invite bonus',
        body: `You earned ${reward} coins: ${name} joined with your invite`,
        noCoordinatorCopy: true,
      }).catch((e) => console.error('invite notify failed', e));
    } catch (err) {
      console.error('awardInvite failed', err);
    }
  }

  return { spin, redeem, awardInvite, httpError };
}

const service = makeCoinsService({
  User: require('../models/User'),
  CoinTransaction: require('../models/CoinTransaction'),
  SpinLog: require('../models/SpinLog'),
  Voucher: require('../models/Voucher'),
  VoucherCode: require('../models/VoucherCode'),
  Redemption: require('../models/Redemption'),
  CoinSettings: require('../models/CoinSettings'),
  notify: require('../utils/notify').createAndEmit,
  randInt: (max) => crypto.randomInt(max),
  now: () => new Date(),
});

module.exports = service;
module.exports.makeCoinsService = makeCoinsService;
module.exports.httpError = httpError;
