const mongoose = require('mongoose');
const ReplySmtpSettings = require('./ReplySmtpSettings');

// Singleton — SMTP account for all app emails (verification, password reset,
// invites, inquiry notifications, partner welcome). Same fields and the same
// env-seeded getSingleton as ReplySmtpSettings, in its own collection.
module.exports = mongoose.model('EmailSettings', ReplySmtpSettings.schema.clone());
