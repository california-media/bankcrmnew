const VolumeBonus = require('../models/VolumeBonus');

/**
 * GET /api/volume-bonuses  (any authenticated user)
 * Response: Array<VolumeBonus> sorted by threshold ascending.
 */
exports.list = async (req, res) => {
  try {
    const bonuses = await VolumeBonus.find().sort({ threshold: 1 });
    res.json(bonuses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/volume-bonuses  (admin)
 * Body: { threshold: number, amount: number, active?: boolean }
 */
exports.create = async (req, res) => {
  try {
    const { threshold, amount, active } = req.body;
    if (threshold == null || amount == null) {
      return res.status(400).json({ message: 'threshold and amount are required' });
    }
    if (Number(threshold) < 1 || Number(amount) < 0) {
      return res.status(400).json({ message: 'threshold must be >= 1 and amount must be >= 0' });
    }
    const bonus = await VolumeBonus.create({
      threshold,
      amount,
      active: active !== undefined ? active : true,
    });
    res.status(201).json(bonus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PUT /api/volume-bonuses/:id  (admin)
 */
exports.update = async (req, res) => {
  try {
    const { threshold, amount, active } = req.body;
    const update = {};
    if (threshold !== undefined) update.threshold = threshold;
    if (amount !== undefined) update.amount = amount;
    if (active !== undefined) update.active = active;
    const bonus = await VolumeBonus.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!bonus) return res.status(404).json({ message: 'Bonus not found' });
    res.json(bonus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /api/volume-bonuses/:id  (admin)
 */
exports.remove = async (req, res) => {
  try {
    const bonus = await VolumeBonus.findByIdAndDelete(req.params.id);
    if (!bonus) return res.status(404).json({ message: 'Bonus not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
