const Bank = require('../models/Bank');
const User = require('../models/User');

/**
 * GET /api/banks  (agency)
 * Returns the calling agency's banks.
 */
exports.list = async (req, res) => {
  try {
    const banks = await Bank.find({ agency: req.user._id }).sort({ name: 1 });
    res.json(banks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/banks/for-agency/:agencyId  (agent, admin)
 * Read-only view of a specific agency's banks. Used by the agent's send-to-agency
 * modal and by admin sending a lead on behalf of an agent.
 */
exports.listForAgency = async (req, res) => {
  try {
    const agency = await User.findOne({ _id: req.params.agencyId, role: 'agency', isActive: true });
    if (!agency) return res.status(404).json({ message: 'Agency not found' });
    const banks = await Bank.find({ agency: agency._id }).sort({ name: 1 });
    res.json(banks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/banks  (agency)
 * Body: { name: string (required), code?: string, description?: string }
 */
exports.create = async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name) return res.status(400).json({ message: 'Bank name is required' });

    const dupe = await Bank.findOne({ agency: req.user._id, name });
    if (dupe) return res.status(409).json({ message: 'You already have a bank with this name' });

    const bank = await Bank.create({ name, code, description, agency: req.user._id });
    res.status(201).json(bank);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PUT /api/banks/:id  (agency)
 */
exports.update = async (req, res) => {
  try {
    const { name, code, description } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (code !== undefined) update.code = code;
    if (description !== undefined) update.description = description;

    const bank = await Bank.findOneAndUpdate(
      { _id: req.params.id, agency: req.user._id },
      update,
      { new: true, runValidators: true }
    );
    if (!bank) return res.status(404).json({ message: 'Bank not found' });
    res.json(bank);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /api/banks/:id  (agency)
 */
exports.remove = async (req, res) => {
  try {
    const bank = await Bank.findOneAndDelete({ _id: req.params.id, agency: req.user._id });
    if (!bank) return res.status(404).json({ message: 'Bank not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
