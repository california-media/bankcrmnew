const Lead = require('../models/Lead');
const Bank = require('../models/Bank');

// POST /leads (agent)
exports.create = async (req, res) => {
  try {
    const { customerName, phone, productType, bank, notes } = req.body;
    if (!customerName || !phone || !productType || !bank) {
      return res.status(400).json({ message: 'customerName, phone, productType, and bank are required' });
    }
    const bankExists = await Bank.findById(bank);
    if (!bankExists) return res.status(400).json({ message: 'Invalid bank' });

    const lead = await Lead.create({
      customerName,
      phone,
      productType,
      bank,
      notes,
      agent: req.user._id,
      status: 'submitted',
    });
    const populated = await lead.populate('bank', 'name code');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /leads/mine (agent)
exports.listMine = async (req, res) => {
  const leads = await Lead.find({ agent: req.user._id })
    .populate('bank', 'name code')
    .sort({ createdAt: -1 });
  res.json(leads);
};

// GET /leads/stats (agent dashboard)
exports.stats = async (req, res) => {
  const agentId = req.user._id;
  const [total, approved, rejected, disbursed, leads] = await Promise.all([
    Lead.countDocuments({ agent: agentId }),
    Lead.countDocuments({ agent: agentId, status: 'approved' }),
    Lead.countDocuments({ agent: agentId, status: 'rejected' }),
    Lead.countDocuments({ agent: agentId, status: 'disbursed' }),
    Lead.find({ agent: agentId }).select('status commission'),
  ]);

  const activeStatuses = ['submitted', 'assigned_to_bank', 'under_review'];
  const active = leads.filter((l) => activeStatuses.includes(l.status)).length;
  const pending = leads.filter((l) => l.status === 'submitted' || l.status === 'under_review').length;
  const earnings = leads
    .filter((l) => l.status === 'disbursed' || l.status === 'approved')
    .reduce((sum, l) => sum + (l.commission || 0), 0);

  res.json({ total, active, approved, rejected, pending, disbursed, earnings });
};
