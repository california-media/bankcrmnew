const path = require('path');
const Resource = require('../models/Resource');
const { getFilename, deleteFromS3 } = require('../middleware/upload.middleware');
const { resolveAgencyId } = require('../middleware/auth.middleware');

const POPULATE = [
  { path: 'bank', select: 'name code logo' },
];

const deleteResourceFile = (filename) => deleteFromS3('resources', filename);

const parseJsonField = (raw) => {
  if (!raw) return [];
  if (typeof raw === 'string') return JSON.parse(raw);
  return raw;
};

const fileTypeFor = (file) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  return ['.jpg', '.jpeg', '.png'].includes(ext) ? 'image' : 'pdf';
};

// GET /api/resources  (all authenticated roles)
exports.list = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { isActive: true };
    // Same visibility filter as cardProduct.controller.js:20-38 /
    // bank.controller.js:16-34 — empty/absent assignedAgencies stays
    // visible to everyone; admin always sees all (incl. inactive).
    if (req.user.role !== 'admin') {
      const agencyId = req.user.role === 'employee' ? resolveAgencyId(req.user) : (req.user.role === 'agency' ? req.user._id : req.user.agency);
      filter.$or = [
        { assignedAgencies: { $exists: false } },
        { assignedAgencies: { $size: 0 } },
        ...(agencyId ? [{ assignedAgencies: agencyId }] : []),
      ];
    }
    const resources = await Resource.find(filter).populate(POPULATE).sort({ createdAt: -1 });
    res.json(resources);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/resources  (admin only)
exports.create = async (req, res) => {
  try {
    const { title, description, bank, type } = req.body;
    if (!title || !type) {
      if (req.file) deleteResourceFile(getFilename(req.file));
      return res.status(400).json({ message: 'title and type are required' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'A file (image or PDF) is required' });
    }
    const resource = await Resource.create({
      title,
      description: description || '',
      bank: bank || null,
      type,
      assignedAgencies: parseJsonField(req.body.assignedAgencies),
      file: getFilename(req.file),
      fileType: fileTypeFor(req.file),
      isActive: req.body.isActive === undefined ? true : req.body.isActive !== 'false' && req.body.isActive !== false,
    });
    const populated = await resource.populate(POPULATE);
    res.status(201).json(populated);
  } catch (err) {
    if (req.file) deleteResourceFile(getFilename(req.file));
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/resources/:id  (admin only)
exports.update = async (req, res) => {
  try {
    const { title, description, bank, type } = req.body;
    const update = {};
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description || '';
    if (bank !== undefined) update.bank = bank || null;
    if (type !== undefined) update.type = type;
    if (req.body.assignedAgencies !== undefined) update.assignedAgencies = parseJsonField(req.body.assignedAgencies);
    if (req.body.isActive !== undefined) update.isActive = req.body.isActive !== 'false' && req.body.isActive !== false;

    if (req.file) {
      const existing = await Resource.findById(req.params.id, 'file');
      if (existing?.file) deleteResourceFile(existing.file);
      update.file = getFilename(req.file);
      update.fileType = fileTypeFor(req.file);
    }

    const resource = await Resource.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
      .populate(POPULATE);
    if (!resource) {
      if (req.file) deleteResourceFile(getFilename(req.file));
      return res.status(404).json({ message: 'Resource not found' });
    }
    res.json(resource);
  } catch (err) {
    if (req.file) deleteResourceFile(getFilename(req.file));
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/resources/:id  (admin only)
exports.remove = async (req, res) => {
  try {
    const resource = await Resource.findByIdAndDelete(req.params.id);
    if (!resource) return res.status(404).json({ message: 'Resource not found' });
    if (resource.file) deleteResourceFile(resource.file);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
