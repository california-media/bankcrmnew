const Notification = require('../models/Notification');
const User = require('../models/User');
const { getIO } = require('./io');

function formatStatus(s) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function getAdminIds() {
  const admins = await User.find({ role: 'admin' }).select('_id').lean();
  return admins.map((a) => String(a._id));
}

async function createAndEmit(recipientIds, data, actorId) {
  const { type, title, body, lead } = data;
  const actorStr = actorId ? String(actorId) : null;
  const unique = [
    ...new Set(
      recipientIds
        .filter(Boolean)
        .map(String)
        .filter((id) => id !== actorStr)
    ),
  ];
  if (!unique.length) return;

  const docs = await Notification.insertMany(
    unique.map((recipient) => ({ recipient, type, title, body, lead: lead || undefined }))
  );

  const io = getIO();
  if (io) {
    docs.forEach((doc) => io.to(String(doc.recipient)).emit('notification', doc));
  }
}

module.exports = { createAndEmit, getAdminIds, formatStatus };
