const CreditNote = require('../models/CreditNote');

// Admin-only. A credit note is a manual balance adjustment against an
// agency's account — kept deliberately separate from the excluded
// invoice/voucher systems.

exports.list = async (req, res) => {
  try {
    const filter = {};
    if (req.query.agency) filter.agency = req.query.agency;
    if (req.query.status) filter.status = req.query.status;
    const notes = await CreditNote.find(filter)
      .populate('agency', 'name email')
      .populate('createdBy', 'name email')
      .populate('lead', 'leadNumber customerName')
      .sort({ createdAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { agency, lead, amount, reason } = req.body;
    if (!agency || !amount || !reason) {
      return res.status(400).json({ message: 'agency, amount and reason are required' });
    }
    const count = await CreditNote.countDocuments();
    const noteNumber = `CN-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
    const note = await CreditNote.create({
      agency,
      lead: lead || undefined,
      amount,
      reason,
      noteNumber,
      createdBy: req.user._id,
    });
    const populated = await note.populate([
      { path: 'agency', select: 'name email' },
      { path: 'createdBy', select: 'name email' },
    ]);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['open', 'settled', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const update = { status };
    if (status === 'settled') {
      update.settledBy = req.user._id;
      update.settledAt = new Date();
    }
    const note = await CreditNote.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('agency', 'name email')
      .populate('createdBy', 'name email');
    if (!note) return res.status(404).json({ message: 'Credit note not found' });
    res.json(note);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const note = await CreditNote.findByIdAndDelete(req.params.id);
    if (!note) return res.status(404).json({ message: 'Credit note not found' });
    res.json({ message: 'Credit note deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
