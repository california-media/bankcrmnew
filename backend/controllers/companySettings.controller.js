const CompanySettings = require('../models/CompanySettings');

exports.get = async (req, res) => {
  try {
    const settings = await CompanySettings.getSingleton();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { bank, notesLines, vatNote, trn, contactName, contactPhone, contactEmail } = req.body;
    if (notesLines && (!Array.isArray(notesLines) || notesLines.some((l) => !String(l || '').trim()))) {
      return res.status(400).json({ message: 'Notes must be a list of non-empty lines' });
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contactEmail).trim())) {
      return res.status(400).json({ message: 'Invalid contact email' });
    }
    const vatRate = req.body.vatRate != null ? Number(req.body.vatRate) : undefined;
    if (vatRate !== undefined && (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100)) {
      return res.status(400).json({ message: 'vatRate must be between 0 and 100' });
    }
    const settings = await CompanySettings.findOneAndUpdate(
      {},
      { $set: { ...(bank && { bank }), ...(notesLines && { notesLines }), ...(vatNote != null && { vatNote }), ...(trn != null && { trn }), ...(vatRate !== undefined && { vatRate }),
        ...(contactName != null && { contactName }), ...(contactPhone != null && { contactPhone }), ...(contactEmail != null && { contactEmail }) } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
