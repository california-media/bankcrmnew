const fs = require('fs');
const path = require('path');
const WelcomeEmailTemplate = require('../models/WelcomeEmailTemplate');
const { WELCOME_FIELDS, sampleFieldValues, customWelcomeEmail, validWelcomeAttachments } = require('../utils/partnerWelcomeEmail');
const { sendWelcomeTestEmail, PARTNER_WELCOME_ASSETS } = require('../utils/email');

const appUrl = () => process.env.CLIENT_URL || 'http://localhost:5173';
// Public link of an uploaded file — same form as voucher logos (utils/coinsShape).
const s3Url = (key) => `https://${process.env.AWS_S3_BUCKET || 'mysilah'}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

const publicTemplate = (doc) => ({
  enabled: doc.enabled,
  subject: doc.subject,
  bodyHtml: doc.bodyHtml,
  attachments: doc.attachments,
  fields: WELCOME_FIELDS,
  updatedAt: doc.updatedAt,
});

/** GET /api/admin/welcome-email */
exports.get = async (req, res) => {
  try {
    res.json(publicTemplate(await WelcomeEmailTemplate.getSingleton()));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** PUT /api/admin/welcome-email — { enabled, subject, bodyHtml, attachments } */
exports.update = async (req, res) => {
  try {
    const { enabled, subject, bodyHtml, attachments = [] } = req.body;
    if (!String(subject || '').trim()) return res.status(400).json({ message: 'Subject is required' });
    if (!String(bodyHtml || '').replace(/<[^>]+>/g, '').trim()) return res.status(400).json({ message: 'Email body is empty' });
    const attachmentError = validWelcomeAttachments(attachments);
    if (attachmentError) return res.status(400).json({ message: attachmentError });
    const doc = await WelcomeEmailTemplate.getSingleton();
    doc.enabled = !!enabled;
    doc.subject = String(subject).trim();
    doc.bodyHtml = String(bodyHtml);
    doc.attachments = attachments.map(({ name, url, size, contentType }) => ({ name, url, size, contentType }));
    doc.updatedBy = req.user._id;
    await doc.save();
    res.json(publicTemplate(doc));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** POST /api/admin/welcome-email/preview — { subject, bodyHtml } → filled with a sample partner */
exports.preview = async (req, res) => {
  try {
    const msg = customWelcomeEmail(req.body, sampleFieldValues(appUrl()), appUrl());
    // The email's logo is an inline attachment (cid:logo); a browser preview needs it embedded.
    const logo = fs.readFileSync(path.join(PARTNER_WELCOME_ASSETS, 'logo.png')).toString('base64');
    res.json({ subject: msg.subject, html: msg.html.replace('cid:logo', `data:image/png;base64,${logo}`) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** POST /api/admin/welcome-email/test — { subject, bodyHtml, attachments } → sent to the signed-in admin */
exports.sendTest = async (req, res) => {
  try {
    if (!req.user.email) return res.status(400).json({ message: 'Your account has no email address' });
    const { subject, bodyHtml, attachments = [] } = req.body;
    const attachmentError = validWelcomeAttachments(attachments);
    if (attachmentError) return res.status(400).json({ message: attachmentError });
    await sendWelcomeTestEmail({ to: req.user.email, subject, bodyHtml, attachments });
    res.json({ to: req.user.email });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** POST /api/admin/welcome-email/attachment — multipart `file` → { name, url, size, contentType } */
exports.uploadAttachment = (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.json({ name: req.file.originalname, url: s3Url(req.file.key), size: req.file.size, contentType: req.file.contentType || req.file.mimetype });
};

/** POST /api/admin/welcome-email/image — multipart `image` → { url } (public S3 link) */
exports.uploadImage = (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
  res.json({ url: s3Url(req.file.key) });
};
