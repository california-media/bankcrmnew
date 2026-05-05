const CommissionRule = require('../models/CommissionRule');
const Bank = require('../models/Bank');

/**
 * GET /api/commission-rules  (agency)
 * Returns rules owned by the calling agency.
 */
exports.list = async (req, res) => {
  try {
    const rules = await CommissionRule.find({ agency: req.user._id })
      .populate('bank', 'name code')
      .sort({ productType: 1, tier: 1 });
    res.json(rules);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/commission-rules  (agency)
 * Body: { productType: 'credit_card'|'loan', bank?: ObjectId, amount: number, tier?: string }
 * If `bank` is provided, it must belong to the calling agency.
 */
exports.create = async (req, res) => {
  try {
    const { productType, bank, amount, tier } = req.body;
    if (!productType || !bank || amount == null) {
      return res.status(400).json({ message: 'productType, bank, and amount are required' });
    }
    if (Number(amount) < 0) return res.status(400).json({ message: 'amount must be >= 0' });

    const owns = await Bank.findOne({ _id: bank, agency: req.user._id });
    if (!owns) return res.status(400).json({ message: 'Bank does not belong to your agency' });

    const dupe = await CommissionRule.findOne({
      agency: req.user._id,
      productType,
      bank,
    });
    if (dupe) return res.status(409).json({ message: 'A rule for this product/bank already exists' });

    const rule = await CommissionRule.create({
      productType,
      bank,
      amount,
      tier,
      agency: req.user._id,
    });
    const populated = await rule.populate('bank', 'name code');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PUT /api/commission-rules/:id  (agency)
 */
exports.update = async (req, res) => {
  try {
    const { productType, bank, amount, tier } = req.body;
    const update = {};
    if (productType !== undefined) update.productType = productType;
    if (bank !== undefined) {
      if (!bank) return res.status(400).json({ message: 'bank is required' });
      const owns = await Bank.findOne({ _id: bank, agency: req.user._id });
      if (!owns) return res.status(400).json({ message: 'Bank does not belong to your agency' });
      update.bank = bank;
    }
    if (amount !== undefined) {
      if (Number(amount) < 0) return res.status(400).json({ message: 'amount must be >= 0' });
      update.amount = amount;
    }
    if (tier !== undefined) update.tier = tier;

    const rule = await CommissionRule.findOneAndUpdate(
      { _id: req.params.id, agency: req.user._id },
      update,
      { new: true, runValidators: true }
    ).populate('bank', 'name code');
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json(rule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /api/commission-rules/:id  (agency)
 */
exports.remove = async (req, res) => {
  try {
    const rule = await CommissionRule.findOneAndDelete({ _id: req.params.id, agency: req.user._id });
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
