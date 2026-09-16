const PromotionTier = require('../models/PromotionTier');
const PromotionAward = require('../models/PromotionAward');
const Lead = require('../models/Lead');
const User = require('../models/User');

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ALL_PRODUCT_TYPES = ['credit_card', 'loan', 'account'];
const TIER_POPULATE = 'name threshold rewardTitle rewardDescription windowType windowMonths productTypes';

// 'YYYY-MM' -> [monthStart, nextMonthStart) as Dates. Defaults to the
// current calendar month if `month` is missing/invalid.
function monthRange(month) {
  const valid = month && MONTH_RE.test(month);
  const key = valid ? month : new Date().toISOString().slice(0, 7);
  const [y, m] = key.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { key, start, end };
}

// windowMonths=1 -> current calendar month only. windowMonths=2 -> previous
// + current calendar month. Whole months only, shifts forward every month —
// not a fixed quarter, not day-granular.
function calendarWindowRange(windowMonths, refDate = new Date()) {
  const y = refDate.getUTCFullYear();
  const m = refDate.getUTCMonth();
  const start = new Date(Date.UTC(y, m - (windowMonths - 1), 1));
  const end = new Date(Date.UTC(y, m + 1, 1));
  return { start, end };
}

// Disbursed-lead count for a given set of product types (cards/loans/
// accounts, any combination), optionally bounded to a date range.
async function disbursedCount(agentId, productTypes, start, end) {
  const filter = { agent: agentId, productType: { $in: productTypes }, status: 'disbursed' };
  if (start && end) filter.createdAt = { $gte: start, $lt: end };
  return Lead.countDocuments(filter);
}

// The count that matters for THIS tier's own configured window + product
// types (e.g. "cards only", "loans + accounts", or all three).
async function countForTier(agentId, tier) {
  const types = (tier.productTypes && tier.productTypes.length) ? tier.productTypes : ['credit_card'];
  if (tier.windowType === 'months' && tier.windowMonths) {
    const { start, end } = calendarWindowRange(tier.windowMonths);
    return disbursedCount(agentId, types, start, end);
  }
  return disbursedCount(agentId, types);
}

// Ensures a PromotionAward exists for every active tier this agent has
// crossed, each measured against its own window + product types. Idempotent
// — safe to call on every page load. Once earned, a tier is never
// un-earned even if a later-shifting rolling window would no longer
// qualify on its own. Returns { tierId: liveCountForThatTier } for every
// active tier, so callers can show live progress without extra queries.
async function syncAwardsForAgent(agentId) {
  const tiers = await PromotionTier.find({ isActive: true });
  const achievedMonth = new Date().toISOString().slice(0, 7);
  const counts = {};
  await Promise.all(tiers.map(async (tier) => {
    const count = await countForTier(agentId, tier);
    counts[String(tier._id)] = count;
    if (count >= tier.threshold) {
      await PromotionAward.updateOne(
        { agent: agentId, tier: tier._id },
        { $setOnInsert: { agent: agentId, tier: tier._id, month: achievedMonth, cardCount: count, status: 'earned' } },
        { upsert: true }
      );
    }
  }));
  return counts;
}

// ---- Tiers ----

// Admin sees every tier; every other role sees only active ones (agents
// shouldn't see a retired promotion still dangling in their list).
exports.listTiers = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { isActive: true };
    const tiers = await PromotionTier.find(filter).sort({ threshold: 1 });
    res.json(tiers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

function validateWindow(body) {
  const windowType = body.windowType || 'lifetime';
  if (!['lifetime', 'months'].includes(windowType)) return 'windowType must be "lifetime" or "months"';
  if (windowType === 'months') {
    const n = Number(body.windowMonths);
    if (!Number.isFinite(n) || n < 1) return 'windowMonths must be a positive number when windowType is "months"';
  }
  return null;
}

function validateProductTypes(body) {
  if (body.productTypes === undefined) return null;
  if (!Array.isArray(body.productTypes) || !body.productTypes.length) {
    return 'productTypes must be a non-empty list';
  }
  if (body.productTypes.some((t) => !ALL_PRODUCT_TYPES.includes(t))) {
    return `productTypes must only contain: ${ALL_PRODUCT_TYPES.join(', ')}`;
  }
  return null;
}

exports.createTier = async (req, res) => {
  try {
    const { name, threshold, rewardTitle, rewardDescription } = req.body;
    if (!name || !threshold || !rewardTitle) {
      return res.status(400).json({ message: 'name, threshold and rewardTitle are required' });
    }
    if (!Number.isFinite(Number(threshold)) || Number(threshold) < 1) {
      return res.status(400).json({ message: 'threshold must be a positive number' });
    }
    const windowErr = validateWindow(req.body);
    if (windowErr) return res.status(400).json({ message: windowErr });
    const productErr = validateProductTypes(req.body);
    if (productErr) return res.status(400).json({ message: productErr });
    const windowType = req.body.windowType || 'lifetime';
    const tier = await PromotionTier.create({
      name, threshold, rewardTitle, rewardDescription,
      windowType,
      windowMonths: windowType === 'months' ? req.body.windowMonths : undefined,
      productTypes: req.body.productTypes || ['credit_card'],
    });
    res.status(201).json(tier);
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
};

exports.updateTier = async (req, res) => {
  try {
    const { name, threshold, rewardTitle, rewardDescription, isActive, windowType, windowMonths, productTypes } = req.body;
    if (threshold !== undefined && (!Number.isFinite(Number(threshold)) || Number(threshold) < 1)) {
      return res.status(400).json({ message: 'threshold must be a positive number' });
    }
    if (windowType !== undefined) {
      const windowErr = validateWindow(req.body);
      if (windowErr) return res.status(400).json({ message: windowErr });
    }
    if (productTypes !== undefined) {
      const productErr = validateProductTypes(req.body);
      if (productErr) return res.status(400).json({ message: productErr });
    }
    const update = {};
    if (name !== undefined) update.name = name;
    if (threshold !== undefined) update.threshold = threshold;
    if (rewardTitle !== undefined) update.rewardTitle = rewardTitle;
    if (rewardDescription !== undefined) update.rewardDescription = rewardDescription;
    if (isActive !== undefined) update.isActive = isActive;
    if (productTypes !== undefined) update.productTypes = productTypes;
    if (windowType !== undefined) {
      update.windowType = windowType;
      update.windowMonths = windowType === 'months' ? windowMonths : undefined;
    }
    const tier = await PromotionTier.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!tier) return res.status(404).json({ message: 'Tier not found' });
    res.json(tier);
  } catch (err) {
    if (err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
};

// Only allowed once nothing has been awarded against it — otherwise an
// agent's earned reward would lose its tier reference. Deactivate instead.
exports.deleteTier = async (req, res) => {
  try {
    const awardCount = await PromotionAward.countDocuments({ tier: req.params.id });
    if (awardCount > 0) {
      return res.status(409).json({ message: 'This tier has already been awarded to agents — deactivate it instead of deleting.' });
    }
    const tier = await PromotionTier.findByIdAndDelete(req.params.id);
    if (!tier) return res.status(404).json({ message: 'Tier not found' });
    res.json({ message: 'Tier deleted' });
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ message: 'Tier not found' });
    res.status(500).json({ message: err.message });
  }
};

// ---- Agent progress ----

// `lifetimeCount`/`monthlyCount` are header stats only — display context
// across ALL product types combined, never used to decide eligibility.
// Each tier is judged against its own window + its own product-type
// selection (see countForTier). Once a tier is earned its displayed count
// is frozen to the snapshot at award time, so it doesn't look like an
// already-earned reward is "un-earning itself" as a rolling window shifts.
exports.myProgress = async (req, res) => {
  try {
    const lifetimeCount = await disbursedCount(req.user._id, ALL_PRODUCT_TYPES);
    const { key: month, start, end } = monthRange(req.query.month);
    const monthlyCount = await disbursedCount(req.user._id, ALL_PRODUCT_TYPES, start, end);

    const liveCounts = await syncAwardsForAgent(req.user._id);

    const awards = await PromotionAward.find({ agent: req.user._id });
    const awardByTier = {};
    awards.forEach((a) => { awardByTier[String(a.tier)] = a; });

    // Active tiers, PLUS any tier this agent already has an award against
    // even if admin has since deactivated it — an earned/sent reward must
    // not vanish from the agent's view just because the promotion was
    // turned off going forward.
    const awardedTierIds = awards.map((a) => a.tier);
    const tiers = await PromotionTier.find({
      $or: [{ isActive: true }, { _id: { $in: awardedTierIds } }],
    }).sort({ threshold: 1 });

    const tierRows = tiers.map((t) => {
      const award = awardByTier[String(t._id)];
      const achieved = !!award;
      const count = achieved ? award.cardCount : (liveCounts[String(t._id)] ?? 0);
      return {
        _id: t._id,
        name: t.name,
        threshold: t.threshold,
        rewardTitle: t.rewardTitle,
        rewardDescription: t.rewardDescription,
        windowType: t.windowType,
        windowMonths: t.windowMonths,
        productTypes: t.productTypes,
        count,
        achieved,
        status: award?.status || null,
        achievedMonth: award?.month || null,
      };
    });

    res.json({ lifetimeCount, month, monthlyCount, tiers: tierRows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---- Admin overview / fulfillment ----

// Recomputes across every agent who has ever disbursed anything (any
// product type) — each tier judged against its own window + product-type
// selection internally. `month`, if passed, only filters the list down to
// awards actually achieved in that month (using the stored achievedMonth
// on each award) — purely a display filter.
exports.adminOverview = async (req, res) => {
  try {
    const agentIds = await Lead.distinct('agent', { productType: { $in: ALL_PRODUCT_TYPES }, status: 'disbursed' });
    await Promise.all(agentIds.map((id) => syncAwardsForAgent(id)));

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.agent) filter.agent = req.query.agent;
    if (req.query.month && MONTH_RE.test(req.query.month)) filter.month = req.query.month;

    const awards = await PromotionAward.find(filter)
      .populate('agent', 'name email')
      .populate('tier', TIER_POPULATE)
      .populate('fulfilledBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ awards });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Per-agent disbursed counts for a specific month, broken down by product
// type — the "in which month did they do how many" view for admin,
// independent of any tier's window/product selection.
exports.monthlyCounts = async (req, res) => {
  try {
    const { key: month, start, end } = monthRange(req.query.month);
    const rows = await Lead.aggregate([
      { $match: { productType: { $in: ALL_PRODUCT_TYPES }, status: 'disbursed', createdAt: { $gte: start, $lt: end }, agent: { $ne: null } } },
      { $group: { _id: { agent: '$agent', productType: '$productType' }, count: { $sum: 1 } } },
    ]);
    const agentIds = [...new Set(rows.map((r) => String(r._id.agent)))];
    const agentDocs = await User.find({ _id: { $in: agentIds } }).select('name email');
    const agentById = {};
    agentDocs.forEach((a) => { agentById[String(a._id)] = a; });

    const byAgent = {};
    rows.forEach((r) => {
      const id = String(r._id.agent);
      if (!byAgent[id]) byAgent[id] = { agent: agentById[id] || null, credit_card: 0, loan: 0, account: 0, total: 0 };
      byAgent[id][r._id.productType] = r.count;
      byAgent[id].total += r.count;
    });

    res.json({ month, rows: Object.values(byAgent).sort((a, b) => b.total - a.total) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateAwardStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!['earned', 'sent', 'redeemed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const update = { status };
    if (notes !== undefined) update.notes = notes;
    if (status !== 'earned') {
      update.fulfilledBy = req.user._id;
      update.fulfilledAt = new Date();
    }
    const award = await PromotionAward.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('agent', 'name email')
      .populate('tier', TIER_POPULATE)
      .populate('fulfilledBy', 'name email');
    if (!award) return res.status(404).json({ message: 'Award not found' });
    res.json(award);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ message: 'Award not found' });
    res.status(500).json({ message: err.message });
  }
};
