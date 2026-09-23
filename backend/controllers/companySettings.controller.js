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
    const { bank, notesLines, vatNote } = req.body;
    if (notesLines && (!Array.isArray(notesLines) || notesLines.some((l) => !String(l || '').trim()))) {
      return res.status(400).json({ message: 'Notes must be a list of non-empty lines' });
    }
    const settings = await CompanySettings.findOneAndUpdate(
      {},
      { $set: { ...(bank && { bank }), ...(notesLines && { notesLines }), ...(vatNote != null && { vatNote }) } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
