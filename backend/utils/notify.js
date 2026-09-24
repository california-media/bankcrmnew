const mongoose = require('mongoose');
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

// Agency Coordinators work the agency-wide pages, so they get a copy of
// every notification sent to their agency's account.
async function getCoordinatorIds(agencyIds) {
  if (!agencyIds.length) return [];
  const coordinators = await User.find({
    role: 'employee',
    employeeType: 'coordinator',
    isActive: true,
    agency: { $in: agencyIds },
  }).select('_id').lean();
  return coordinators.map((c) => String(c._id));
}

async function createAndEmit(recipientIds, data, actorId) {
  const { type, title, body, lead } = data;
  const actorStr = actorId ? String(actorId) : null;
  const baseIds = recipientIds.filter(Boolean).map(String).filter((id) => mongoose.Types.ObjectId.isValid(id));
  const agencyIds = baseIds.length
    ? (await User.find({ _id: { $in: baseIds }, role: 'agency' }).select('_id').lean()).map((a) => String(a._id))
    : [];
  const coordinatorIds = await getCoordinatorIds(agencyIds);
  const unique = [
    ...new Set(
      [...baseIds, ...coordinatorIds].filter((id) => id !== actorStr)
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
