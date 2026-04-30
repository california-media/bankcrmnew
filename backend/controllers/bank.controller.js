const Bank = require('../models/Bank');

/**
 * GET /api/banks  (any authenticated user)
 * Response: Array<{ _id, name, code, description, createdAt, updatedAt }>
 */
exports.list = async (req, res) => {
  try {
    const banks = await Bank.find().sort({ name: 1 });
    res.json(banks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/banks  (admin)
 * Body: { name: string (required), code?: string, description?: string }
 * Response 201: { _id, name, code, description, ... }
 */
exports.create = async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Bank name is required' });
    const bank = await Bank.create({ name, code, description });
    res.status(201).json(bank);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Bank already exists' });
    res.status(500).json({ message: err.message });
  }
};

/**
 * PUT /api/banks/:id  (admin)
 * Body: { name?: string, code?: string, description?: string }
 * Response: updated bank document
 */
exports.update = async (req, res) => {
  try {
    const { name, code, description } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (code !== undefined) update.code = code;
    if (description !== undefined) update.description = description;

    const bank = await Bank.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!bank) return res.status(404).json({ message: 'Bank not found' });
    res.json(bank);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Bank name already in use' });
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /api/banks/:id  (admin)
 * Response: { ok: true }
 */
exports.remove = async (req, res) => {
  try {
    const bank = await Bank.findByIdAndDelete(req.params.id);
    if (!bank) return res.status(404).json({ message: 'Bank not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
