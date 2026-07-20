const Notification = require('../models/Notification');

exports.list = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const { ids, all } = req.body;
    const filter = { recipient: req.user._id };
    if (all) {
      filter.isRead = false;
    } else {
      if (!Array.isArray(ids) || !ids.length)
        return res.status(400).json({ message: 'ids array required' });
      filter._id = { $in: ids };
    }
    await Notification.updateMany(filter, { isRead: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
