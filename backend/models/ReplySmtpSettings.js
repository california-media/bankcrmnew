const mongoose = require('mongoose');

// Singleton — SMTP account used ONLY for replying to website requests
// (SiteInquiry). All other app emails keep using the SMTP_* env vars.
// The password is stored encrypted (see utils/secretBox.js) and is never
// sent back to the client.
const replySmtpSettingsSchema = new mongoose.Schema(
  {
    host: { type: String, trim: true, default: '' },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    user: { type: String, trim: true, default: '' },
    passEncrypted: { type: String, default: '' },
    fromName: { type: String, trim: true, default: 'MySilah' },
    fromEmail: { type: String, trim: true, lowercase: true, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Until the admin saves their own, start from the app's main SMTP_* env
// account. Only fills a never-configured doc, so admin edits are never overwritten.
replySmtpSettingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) doc = new this({});
  if (!doc.host && !doc.passEncrypted && process.env.SMTP_HOST && process.env.SMTP_PASS) {
    const { encrypt } = require('../utils/secretBox');
    doc.host = process.env.SMTP_HOST;
    doc.port = Number(process.env.SMTP_PORT) || 587;
    doc.secure = process.env.SMTP_SECURE === 'true';
    doc.user = process.env.SMTP_USER || '';
    doc.passEncrypted = encrypt(process.env.SMTP_PASS);
    doc.fromName = 'MySilah';
    doc.fromEmail = (process.env.SMTP_FROM || process.env.SMTP_USER || '').toLowerCase();
  }
  if (doc.isNew || doc.isModified()) await doc.save();
  return doc;
};

module.exports = mongoose.model('ReplySmtpSettings', replySmtpSettingsSchema);
