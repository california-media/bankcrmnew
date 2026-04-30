const Bank = require('../models/Bank');

// GET /banks  (any authenticated user — agencies/agents need to list)
exports.list = async (req, res) => {
  const banks = await Bank.find().sort({ name: 1 });
  res.json(banks);
};

// POST /banks (admin)
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

// PUT /banks/:id (admin)
exports.update = async (req, res) => {
  try {
    const bank = await Bank.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!bank) return res.status(404).json({ message: 'Bank not found' });
    res.json(bank);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /banks/:id (admin)
exports.remove = async (req, res) => {
  const bank = await Bank.findByIdAndDelete(req.params.id);
  if (!bank) return res.status(404).json({ message: 'Bank not found' });
  res.json({ ok: true });
};
