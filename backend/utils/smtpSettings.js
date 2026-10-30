const { encrypt } = require('./secretBox');

// SMTP settings as the client sees them — never includes the password.
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

// GET / PUT handlers for a singleton SMTP settings model (Super Admin).
// PUT body: { host, port, secure, user, pass?, fromName, fromEmail }
// A blank pass keeps the saved one.
const smtpSettingsHandlers = (Model) => ({
  get: async (req, res) => {
    try {
      res.json(publicSmtp(await Model.getSingleton()));
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },
  update: async (req, res) => {
    try {
      const { host, port, secure, user, pass, fromName, fromEmail } = req.body;
      if (!host || !user) return res.status(400).json({ message: 'SMTP host and username are required' });
      const doc = await Model.getSingleton();
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
  },
});

module.exports = { smtpSettingsHandlers };
