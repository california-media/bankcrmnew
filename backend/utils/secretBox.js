const crypto = require('crypto');

// AES-256-GCM for small secrets stored in the DB (e.g. the reply SMTP
// password). Key comes from SETTINGS_ENCRYPTION_KEY, falling back to
// JWT_SECRET so it works without extra setup. Changing the key makes
// previously saved secrets unreadable — they just need to be re-entered.
const key = () =>
  crypto.createHash('sha256').update(process.env.SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET || '').digest();

const encrypt = (plain) => {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
};

const decrypt = (boxed) => {
  if (!boxed) return '';
  try {
    const [iv, tag, data] = boxed.split('.').map((s) => Buffer.from(s, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
};

module.exports = { encrypt, decrypt };
