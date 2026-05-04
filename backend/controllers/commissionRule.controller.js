const CommissionRule = require('../models/CommissionRule');

/**
 * GET /api/commission-rules  (admin, agency, agent — read-only for non-admins)
 * Response: Array<CommissionRule with bank populated>
 */
exports.list = async (req, res) => {
  try {
    const rules = await CommissionRule.find().populate('bank', 'name code').sort({ productType: 1, tier: 1 });
    res.json(rules);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/commission-rules  (admin)
 * Body: { productType: 'credit_card'|'loan', bank?: ObjectId, amount: number, tier?: string }
 * Uniqueness on (productType, bank) is enforced at the controller level.
 */
exports.create = async (req, res) => {
  try {
    const { productType, bank, amount, tier } = req.body;
    if (!productType || amount == null) {
      return res.status(400).json({ message: 'productType and amount are required' });
    }
    if (Number(amount) < 0) return res.status(400).json({ message: 'amount must be >= 0' });

    const dupe = await CommissionRule.findOne({ productType, bank: bank || null });
    if (dupe) return res.status(409).json({ message: 'A rule for this product/bank already exists' });

    const rule = await CommissionRule.create({
      productType,
      bank: bank || null,
      amount,
      tier,
    });
    const populated = await rule.populate('bank', 'name code');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PUT /api/commission-rules/:id  (admin)
 * Body: { productType?, bank?, amount?, tier? }
 */
exports.update = async (req, res) => {
  try {
    const { productType, bank, amount, tier } = req.body;
    const update = {};
    if (productType !== undefined) update.productType = productType;
    if (bank !== undefined) update.bank = bank || null;
    if (amount !== undefined) {
      if (Number(amount) < 0) return res.status(400).json({ message: 'amount must be >= 0' });
      update.amount = amount;
    }
    if (tier !== undefined) update.tier = tier;

    const rule = await CommissionRule.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).populate('bank', 'name code');
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json(rule);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /api/commission-rules/:id  (admin)
 */
exports.remove = async (req, res) => {
  try {
    const rule = await CommissionRule.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
