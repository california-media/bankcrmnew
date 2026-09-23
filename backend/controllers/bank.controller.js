const Bank = require('../models/Bank');
const { getFilename, deleteFromS3 } = require('../middleware/upload.middleware');
const { resolveAgencyId } = require('../middleware/auth.middleware');

const deleteLogo = (filename) => deleteFromS3('bank-logos', filename);

const parseAgencies = (raw) => {
  if (raw === undefined) return undefined;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try { return JSON.parse(raw); } catch { return raw ? [raw] : []; }
  }
  return [];
};

exports.list = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { isActive: true };
    // Product Admin's per-agency assignment — empty/absent assignedAgencies
    // stays visible to everyone (unchanged default); admin always sees all.
    if (req.user.role !== 'admin') {
      const agencyId = req.user.role === 'employee' ? resolveAgencyId(req.user) : (req.user.role === 'agency' ? req.user._id : req.user.agency);
      filter.$or = [
        { assignedAgencies: { $exists: false } },
        { assignedAgencies: { $size: 0 } },
        ...(agencyId ? [{ assignedAgencies: agencyId }] : []),
      ];
    }
    const banks = await Bank.find(filter).sort({ name: 1 });
    res.json(banks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, code, description, hasSpend, hasCpv, hasActivation } = req.body;
    if (!name) return res.status(400).json({ message: 'Bank name is required' });

    const dupe = await Bank.findOne({ name });
    if (dupe) return res.status(409).json({ message: 'A bank with this name already exists' });

    const bank = await Bank.create({
      name, code, description,
      hasSpend: hasSpend === 'true' || hasSpend === true,
      ...(hasCpv !== undefined && { hasCpv: hasCpv === 'true' || hasCpv === true }),
      ...(hasActivation !== undefined && { hasActivation: hasActivation === 'true' || hasActivation === true }),
      logo: req.file ? getFilename(req.file) : undefined,
      assignedAgencies: parseAgencies(req.body.assignedAgencies) || [],
    });
    res.status(201).json(bank);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, code, description, isActive, hasSpend, hasCpv, hasActivation } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (code !== undefined) update.code = code;
    if (description !== undefined) update.description = description;
    if (isActive !== undefined) update.isActive = isActive;
    if (hasSpend !== undefined) update.hasSpend = hasSpend === 'true' || hasSpend === true;
    if (hasCpv !== undefined) update.hasCpv = hasCpv === 'true' || hasCpv === true;
    if (hasActivation !== undefined) update.hasActivation = hasActivation === 'true' || hasActivation === true;
    const parsedAgencies = parseAgencies(req.body.assignedAgencies);
    if (parsedAgencies !== undefined) update.assignedAgencies = parsedAgencies;

    if (req.file) {
      const existing = await Bank.findById(req.params.id, 'logo');
      if (existing?.logo) deleteLogo(existing.logo);
      update.logo = getFilename(req.file);
    }

    const bank = await Bank.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!bank) return res.status(404).json({ message: 'Bank not found' });
    res.json(bank);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const bank = await Bank.findByIdAndDelete(req.params.id);
    if (!bank) return res.status(404).json({ message: 'Bank not found' });
    if (bank.logo) deleteLogo(bank.logo);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
