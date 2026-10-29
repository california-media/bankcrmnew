const crypto = require('crypto');
const {
  dubaiDayKey, pickSegmentIndex, voucherValidFilter, DEFAULT_TIERS, ACTIVITY_TYPES, streakDays, nextBonus,
  tierFor, dubaiWeekRange, dubaiMonthRange, resolveMissions,
} = require('../utils/coins');
const { balanceOf } = require('../utils/coinsShape');

const httpError = (status, message) => Object.assign(new Error(message), { status });
const isDup = (err) => err && err.code === 11000;
const firstName = (name) => (String(name || '').trim().split(/\s+/)[0] || 'a partner');
// Spin days read back for a streak; a longer streak simply reads as this many days.
const STREAK_SCAN = 400;

// No Mongo transactions: every money move is a guarded atomic update, ordered so
// a failure at any step never loses coins or hands one code to two agents.
function makeCoinsService(deps) {
  const {
    User, CoinTransaction, SpinLog, Voucher, VoucherCode, Redemption, CoinSettings, Lead, CoinActivity, EmployeeStatus,
    notify, randInt, now,
  } = deps;

  // Once-only award. The ledger row (unique {user, awardKey}) is the guard, written first like awardInvite.
  // Returns { balance } or null when this award was already paid.
  async function awardOnce(userId, { type, awardKey, amount, title }) {
    let tx;
    try {
      tx = await CoinTransaction.create({ user: userId, type, awardKey, amount, balanceAfter: 0, title });
    } catch (err) {
      if (isDup(err)) return null;
      throw err;
    }
    // A thrown error here may still have applied the $inc: keep the guard row (balanceAfter 0 marks it for reconciliation).
    const u = await User.findOneAndUpdate({ _id: userId, role: 'agent' }, { $inc: { coinBalance: amount } }, { new: true });
    if (!u) {
      // Definitively not credited: drop the guard row so a retry can still pay.
      await CoinTransaction.deleteOne({ _id: tx._id }).catch((e) => console.error(`${type} award rollback failed`, e));
      throw httpError(404, 'User not found');
    }
    await CoinTransaction.updateOne({ _id: tx._id }, { $set: { balanceAfter: balanceOf(u) } })
      .catch((e) => console.error(`${type} award balanceAfter update failed`, e));
    return { balance: balanceOf(u) };
  }

  const spinDayKeys = async (userId) =>
    (await SpinLog.find({ user: userId }).select('dayKey').sort({ dayKey: -1 }).limit(STREAK_SCAN).lean()).map((r) => r.dayKey);

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
    // A thrown error here may still have applied the $inc, so the log is kept (one spin lost, never two credits).
    const u = await User.findOneAndUpdate({ _id: userId, role: 'agent' }, { $inc: { coinBalance: coins } }, { new: true });
    if (!u) {
      // Definitively not credited: free the day's spin.
      await SpinLog.deleteOne({ _id: log._id }).catch((e) => console.error('spin rollback failed', e));
      throw httpError(404, 'User not found');
    }
    try {
      await CoinTransaction.create({
        user: userId, type: 'spin', amount: coins, balanceAfter: balanceOf(u), title: 'Daily spin', spin: log._id,
      });
    } catch (err) {
      console.error('spin ledger write failed (balance already credited)', err); // coins are safe; only history is missing
    }
    let balance = balanceOf(u);
    let streakBonus = null;
    const bonuses = settings.streakBonuses || [];
    if (bonuses.length) {
      // The spin is already paid: a bonus failure is logged, never fails the request.
      try {
        const today = log.dayKey;
        const days = streakDays([today, ...(await spinDayKeys(userId))], today);
        const hit = bonuses.find((b) => b.days === days);
        if (hit) {
          const r = await awardOnce(userId, {
            type: 'streak',
            // At most once per milestone per Dubai month (of the award day): breaking and rebuilding a streak
            // inside the month does not pay the same milestone again.
            awardKey: `streak:${hit.days}:${today.slice(0, 7)}`,
            amount: hit.coins,
            title: `${hit.days}-day streak bonus`,
          });
          if (r) {
            balance = r.balance;
            streakBonus = { days: hit.days, coins: hit.coins };
          }
        }
      } catch (err) {
        console.error('streak bonus failed', err);
      }
    }
    return { segmentIndex: i, coins, balance, streakBonus };
  }

  // userId must be an ObjectId (req.user._id): $match in an aggregate does not cast.
  async function summary(userId) {
    const today = dubaiDayKey(now());
    const [settings, user, earned, dayKeys] = await Promise.all([
      CoinSettings.getSingleton(),
      User.findById(userId).select('coinBalance').lean(),
      CoinTransaction.aggregate([
        // A once-only award still at balanceAfter 0 was never (or not yet) credited: not earned.
        { $match: { user: userId, amount: { $gt: 0 }, $nor: [{ awardKey: { $type: 'string' }, balanceAfter: 0 }] } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      spinDayKeys(userId),
    ]);
    const lifetime = (earned[0] && earned[0].total) || 0;
    const list = settings.tiers && settings.tiers.length ? settings.tiers : DEFAULT_TIERS;
    const tiers = list.map((t) => ({ name: t.name, minCoins: t.minCoins })).sort((a, b) => a.minCoins - b.minCoins);
    const { tier, nextTier } = tierFor(tiers, lifetime);
    const days = streakDays(dayKeys, today);
    return {
      balance: balanceOf(user),
      lifetime,
      tier,
      nextTier,
      tiers,
      streak: { days, spunToday: dayKeys.includes(today), nextBonus: nextBonus(settings.streakBonuses, days) },
      promoText: settings.promoText || '',
    };
  }

  async function recordActivity(userId, type) {
    if (!ACTIVITY_TYPES.includes(type)) throw httpError(400, 'Unknown activity');
    try {
      await CoinActivity.create({ user: userId, type, dayKey: dubaiDayKey(now()) });
    } catch (err) {
      if (!isDup(err)) throw err; // already recorded today
    }
  }

  const consentIds = async (pattern) =>
    (await EmployeeStatus.find({ statusType: 'whatsapp_consent', label: { $regex: pattern } }).select('_id').lean()).map((s) => s._id);

  // Current Dubai periods and the claim key part for each mission period.
  const periodsAt = (t) => {
    const month = dubaiMonthRange(t);
    const week = dubaiWeekRange(t);
    return { month, week, keyFor: { month: month.key, week: week.key, once: 'once' } };
  };

  async function missionProgress(userId, key, { month, week }) {
    const inMonth = { $gte: month.start, $lt: month.end };
    switch (key) {
      case 'submit_leads':
        return Lead.countDocuments({ agent: userId, status: { $ne: 'draft' }, createdAt: inMonth });
      case 'share_link':
        return CoinActivity.countDocuments({ user: userId, type: 'share_link', dayKey: { $gte: week.startKey, $lte: week.endKey } });
      case 'consents': {
        const ids = await consentIds(/confirm/i); // same label match as the WhatsApp webhook
        return ids.length ? Lead.countDocuments({ agent: userId, createdAt: inMonth, consentStatus: { $in: ids } }) : 0;
      }
      case 'approvals': // same rule as /leads/stats thisMonth.approved, on the Dubai month
        return Lead.countDocuments({ agent: userId, createdAt: inMonth, status: { $in: ['approved', 'disbursed'] } });
      case 'watch_guide':
        return CoinActivity.countDocuments({ user: userId, type: 'watch_guide' });
      default:
        return 0;
    }
  }

  const missionAwardKey = (m, keyFor) => `mission:${m.key}:${keyFor[m.period]}`;

  async function missions(userId) {
    const p = periodsAt(now());
    const settings = await CoinSettings.getSingleton();
    const list = resolveMissions(settings.missions).filter((m) => m.enabled);
    if (!list.length) return { items: [] };
    const [progress, claimedRows] = await Promise.all([
      Promise.all(list.map((m) => missionProgress(userId, m.key, p))),
      CoinTransaction.find({ user: userId, awardKey: { $in: list.map((m) => missionAwardKey(m, p.keyFor)) } }).select('awardKey').lean(),
    ]);
    const claimed = new Set(claimedRows.map((r) => r.awardKey));
    return {
      items: list.map((m, i) => ({
        key: m.key, title: m.title, subtitle: m.subtitle, target: m.target, progress: progress[i], coins: m.coins,
        period: m.period, claimed: claimed.has(missionAwardKey(m, p.keyFor)),
      })),
    };
  }

  async function claimMission(userId, key) {
    const p = periodsAt(now());
    const settings = await CoinSettings.getSingleton();
    const m = resolveMissions(settings.missions).find((x) => x.key === key && x.enabled);
    if (!m) throw httpError(404, 'Challenge not found');
    const awardKey = missionAwardKey(m, p.keyFor);
    if (await CoinTransaction.exists({ user: userId, awardKey })) throw httpError(409, 'Already claimed');
    if ((await missionProgress(userId, m.key, p)) < m.target) throw httpError(400, 'This challenge is not complete yet');
    const r = await awardOnce(userId, { type: 'mission', awardKey, amount: m.coins, title: `Challenge: ${m.title}` });
    if (!r) throw httpError(409, 'Already claimed'); // lost a race with a parallel claim
    return { coins: m.coins, balance: r.balance };
  }

  async function redeem(userId, voucherId) {
    const voucher = await Voucher.findOne({ _id: voucherId, isActive: true, ...voucherValidFilter(now()) });
    if (!voucher) throw httpError(404, 'Voucher not found');
    const cost = voucher.coinCost;

    // 1. Claim a code atomically: two requests can never get the same one.
    const code = await VoucherCode.findOneAndUpdate(
      { voucher: voucher._id, status: 'available' },
      { $set: { status: 'assigned', assignedTo: userId, assignedAt: now() } },
      { new: true }
    );
    if (!code) throw httpError(409, 'Out of stock');

    // Frees only the code this request claimed, while it is still ours and not linked to a redemption.
    const release = () =>
      VoucherCode.updateOne(
        { _id: code._id, status: 'assigned', assignedTo: userId, redemption: null },
        { $set: { status: 'available' }, $unset: { assignedTo: 1, assignedAt: 1 } }
      );

    // 2. Guarded debit: the $gte filter is what prevents a negative balance.
    // A thrown error may still have applied the debit: leave the code held (assignedTo is the reconciliation trace).
    const u = await User.findOneAndUpdate(
      { _id: userId, role: 'agent', coinBalance: { $gte: cost } },
      { $inc: { coinBalance: -cost } },
      { new: true }
    );
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
      // The insert may have applied. Compensate only if this user's row definitively does not exist.
      // User-scoped: with the unique voucherCode index, a duplicate owned by someone else is never our success.
      let existing;
      try {
        existing = await Redemption.findOne({ voucherCode: code._id, user: userId });
      } catch (e) {
        console.error('redemption lookup failed; not compensating', e);
        throw err;
      }
      if (existing) {
        r = existing; // it was written: carry on as success with the full row
      } else {
        try {
          await User.findOneAndUpdate({ _id: userId }, { $inc: { coinBalance: cost } });
        } catch (e) {
          console.error('refund failed; code left held for reconciliation', e);
          throw err;
        }
        if (isDup(err)) {
          // The code already backs another redemption: back in the pool it would fail every next redeemer.
          console.error('code already linked to another redemption; left held for reconciliation', code._id);
        } else {
          await release().catch((e) => console.error('code release failed', e));
        }
        throw err;
      }
    }
    // Charged and code held by now; ledger/back-link failures must not fail the request.
    try {
      await CoinTransaction.create({
        user: userId, type: 'redeem', amount: -cost, balanceAfter: balanceOf(u), title: `${voucher.title} redeemed`, redemption: r._id,
      });
    } catch (err) {
      console.error('redeem ledger write failed', err);
    }
    try {
      await VoucherCode.updateOne({ _id: code._id }, { $set: { redemption: r._id } });
    } catch (err) {
      console.error('redeem code back-link failed', err);
    }
    return { redemption: r, balance: balanceOf(u) };
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
      // A thrown error may have applied the $inc: keep the guard row (balanceAfter 0 marks it for reconciliation).
      const u = await User.findOneAndUpdate({ _id: inviter._id }, { $inc: { coinBalance: reward } }, { new: true });
      if (!u) {
        // Definitively not credited: drop the guard row so a later retry can still pay.
        await CoinTransaction.deleteOne({ _id: tx._id }).catch((e) => console.error('invite rollback failed', e));
        throw new Error('inviter vanished');
      }
      await CoinTransaction.updateOne({ _id: tx._id }, { $set: { balanceAfter: balanceOf(u) } })
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

  return { spin, redeem, awardInvite, summary, recordActivity, missions, claimMission, httpError };
}

const service = makeCoinsService({
  User: require('../models/User'),
  CoinTransaction: require('../models/CoinTransaction'),
  SpinLog: require('../models/SpinLog'),
  Voucher: require('../models/Voucher'),
  VoucherCode: require('../models/VoucherCode'),
  Redemption: require('../models/Redemption'),
  CoinSettings: require('../models/CoinSettings'),
  Lead: require('../models/Lead'),
  CoinActivity: require('../models/CoinActivity'),
  EmployeeStatus: require('../models/EmployeeStatus'),
  notify: require('../utils/notify').createAndEmit,
  randInt: (max) => crypto.randomInt(max),
  now: () => new Date(),
});

module.exports = service;
module.exports.makeCoinsService = makeCoinsService;
module.exports.httpError = httpError;
