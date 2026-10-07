const SiteInquiry = require('../models/SiteInquiry');
const ReplySmtpSettings = require('../models/ReplySmtpSettings');
const { sendInquiryNotification, sendInquiryConfirmation, sendInquiryReply } = require('../utils/email');
const { encrypt, decrypt } = require('../utils/secretBox');
const { sanitizeEmailHtml, htmlToText } = require('../utils/emailHtml');
const { putToS3, fileMimeType } = require('../middleware/upload.middleware');

exports.submit = async (req, res) => {
  try {
    const { name, email, phone, companyName, message, queryType } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email required' });
    // Older copies of the website form don't send a type — treat those as a general query
    const type = queryType === undefined || queryType === '' ? 'general' : queryType;
    if (!['general', 'support', 'other'].includes(type)) {
      return res.status(400).json({ message: 'Query type must be general, support or other' });
    }

    const inquiry = await SiteInquiry.create({ name, email, phone, companyName, message, queryType: type });

    sendInquiryNotification({ name, email, phone, companyName, message, queryType: type }).catch((err) =>
      console.error('[inquiry email]', err.message)
    );
    sendInquiryConfirmation({ name, email }).catch((err) =>
      console.error('[inquiry confirmation]', err.message)
    );

    res.status(201).json({ ok: true, id: inquiry._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    const { read } = req.query;
    const filter = {};
    if (read === 'true') filter.read = true;
    if (read === 'false') filter.read = false;

    const inquiries = await SiteInquiry.find(filter).populate('replies.sentBy', 'name email').sort({ createdAt: -1 });
    res.json(inquiries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const inquiry = await SiteInquiry.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    if (!inquiry) return res.status(404).json({ message: 'Not found' });
    res.json(inquiry);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteInquiry = async (req, res) => {
  try {
    await SiteInquiry.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Reply SMTP settings as the client sees them — never includes the password.
const publicSmtp = (doc) => ({
  host: doc.host,
  port: doc.port,
  secure: doc.secure,
  user: doc.user,
  fromName: doc.fromName,
  fromEmail: doc.fromEmail,
  hasPassword: !!doc.passEncrypted,
  configured: !!(doc.host && doc.user && doc.passEncrypted),
  updatedAt: doc.updatedAt,
});

/**
 * GET /api/inquiries/smtp-settings  (Super Admin)
 */
exports.getSmtpSettings = async (req, res) => {
  try {
    res.json(publicSmtp(await ReplySmtpSettings.getSingleton()));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PUT /api/inquiries/smtp-settings  (Super Admin)
 * Body: { host, port, secure, user, pass?, fromName, fromEmail }
 * A blank pass keeps the saved one.
 */
exports.updateSmtpSettings = async (req, res) => {
  try {
    const { host, port, secure, user, pass, fromName, fromEmail } = req.body;
    if (!host || !user) return res.status(400).json({ message: 'SMTP host and username are required' });
    const doc = await ReplySmtpSettings.getSingleton();
    doc.host = String(host).trim();
    doc.port = Number(port) || 587;
    doc.secure = !!secure;
    doc.user = String(user).trim();
    if (pass) doc.passEncrypted = encrypt(pass);
    if (!doc.passEncrypted) return res.status(400).json({ message: 'SMTP password is required' });
    doc.fromName = (fromName || 'MySilah').trim();
    doc.fromEmail = (fromEmail || '').trim();
    doc.updatedBy = req.user._id;
    await doc.save();
    res.json(publicSmtp(doc));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024; // stay under common 25 MB mail limits
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

// cc/bcc arrive as a JSON array string (multipart) — or a comma list.
const parseEmailList = (raw) => {
  if (!raw) return [];
  let list = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw); } catch { list = raw.split(/[,;]/); }
  }
  if (!Array.isArray(list)) list = [list];
  return [...new Set(list.map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
};

/**
 * POST /api/inquiries/:id/reply  (Admin / Admin Coordinator)
 * multipart/form-data: subject, bodyHtml, to?, cc?, bcc? (JSON arrays; to defaults to the requester), files[] (≤10, 10 MB each, 20 MB total)
 * Emails the request's sender, then stores the attachments and logs the reply.
 */
exports.reply = async (req, res) => {
  try {
    const files = req.files || [];
    const subject = String(req.body.subject || '').trim();
    const bodyHtml = sanitizeEmailHtml(req.body.bodyHtml || '');
    const bodyText = htmlToText(bodyHtml);
    const toRaw = req.body.to;
    const cc = parseEmailList(req.body.cc);
    const bcc = parseEmailList(req.body.bcc);

    if (!subject) return res.status(400).json({ message: 'Subject is required' });
    if (subject.length > 250) return res.status(400).json({ message: 'Subject is too long' });
    if (!bodyText && !files.length) return res.status(400).json({ message: 'Write a message or attach a file' });
    const totalBytes = files.reduce((n, f) => n + f.size, 0);
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) return res.status(400).json({ message: 'Attachments are larger than 20 MB in total' });

    const inquiry = await SiteInquiry.findById(req.params.id);
    if (!inquiry) return res.status(404).json({ message: 'Not found' });

    // "To" is editable in the composer (the requester can be removed);
    // older clients that don't send it reply to the requester.
    const to = toRaw === undefined ? [inquiry.email.toLowerCase()] : parseEmailList(toRaw);
    const badEmail = [...to, ...cc, ...bcc].find((e) => !EMAIL_RE.test(e));
    if (badEmail) return res.status(400).json({ message: `Invalid email address: ${badEmail}` });
    if (!to.length && !cc.length && !bcc.length) return res.status(400).json({ message: 'Add at least one recipient' });
    if (to.length + cc.length + bcc.length > 20) return res.status(400).json({ message: 'Too many recipients (max 20)' });
    // Greet the requester by name only when they're actually a recipient
    const toRequester = [...to, ...cc, ...bcc].includes(inquiry.email.toLowerCase());

    const settings = await ReplySmtpSettings.getSingleton();
    const pass = decrypt(settings.passEncrypted);
    if (!settings.host || !settings.user || !pass) {
      return res.status(400).json({ message: 'Reply email (SMTP) is not set up yet. Ask the Super Admin to save the SMTP settings.' });
    }

    try {
      await sendInquiryReply({
        smtp: { ...settings.toObject(), pass },
        to,
        cc,
        bcc,
        name: toRequester ? inquiry.name : null,
        subject,
        bodyHtml: bodyHtml || '<p style="margin:0;">Please find the attached file(s).</p>',
        bodyText: bodyText || 'Please find the attached file(s).',
        attachments: files.map((f) => ({ filename: f.originalname, content: f.buffer, contentType: fileMimeType(f) })),
        senderName: req.user.name,
        original: inquiry,
      });
    } catch (err) {
      return res.status(502).json({ message: `Email could not be sent: ${err.message}` });
    }

    // Email is out — keep a copy of each attachment for the reply history.
    // A storage failure must not report the (already sent) email as failed.
    const attachments = await Promise.all(files.map(async (f) => {
      const meta = { originalName: f.originalname, mimeType: fileMimeType(f), size: f.size };
      try {
        return { ...meta, filename: await putToS3('inquiry-reply-files', f) };
      } catch (err) {
        console.error('[inquiry reply attachment]', f.originalname, err.message);
        return { ...meta, filename: '' };
      }
    }));

    inquiry.replies.push({ subject, body: bodyText, bodyHtml, to, cc, bcc, attachments, sentBy: req.user._id, sentAt: new Date() });
    inquiry.read = true;
    await inquiry.save();
    await inquiry.populate('replies.sentBy', 'name email');
    res.json(inquiry);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
