// backend/controllers/notice.controller.js
const Notice = require('../models/Notice');

exports.createNotice = async (req, res) => {
  try {
    const { title, message, targetRoles, startDate, endDate, isActive } = req.body;
    const notice = await Notice.create({
      title,
      message,
      targetRoles,
      startDate,
      endDate,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id,
    });
    res.status(201).json(notice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.listNotices = async (req, res) => {
  try {
    const notices = await Notice.find().sort({ startDate: -1 }).lean();
    res.json(notices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateNotice = async (req, res) => {
  try {
    const { title, message, targetRoles, startDate, endDate, isActive } = req.body;
    const update = {};
    if (title       !== undefined) update.title       = title;
    if (message     !== undefined) update.message     = message;
    if (targetRoles !== undefined) update.targetRoles = targetRoles;
    if (startDate   !== undefined) update.startDate   = startDate;
    if (endDate     !== undefined) update.endDate     = endDate;
    if (isActive    !== undefined) update.isActive    = isActive;

    if (update.startDate !== undefined || update.endDate !== undefined) {
      const existing = await Notice.findById(req.params.id).lean();
      if (!existing) return res.status(404).json({ message: 'Notice not found' });
      const start = update.startDate ? new Date(update.startDate) : existing.startDate;
      const end   = update.endDate   ? new Date(update.endDate)   : existing.endDate;
      if (end <= start) return res.status(400).json({ message: 'endDate must be after startDate' });
    }

    const notice = await Notice.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!notice) return res.status(404).json({ message: 'Notice not found' });
    res.json(notice);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteNotice = async (req, res) => {
  try {
    const notice = await Notice.findByIdAndDelete(req.params.id);
    if (!notice) return res.status(404).json({ message: 'Notice not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getActiveNotices = async (req, res) => {
  try {
    const now = new Date();
    const notices = await Notice.find({
      isActive: true,
      targetRoles: req.user.role,
      startDate: { $lte: now },
      endDate:   { $gte: now },
    })
      .sort({ startDate: -1 })
      .lean();
    res.json(notices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
