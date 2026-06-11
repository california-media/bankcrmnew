const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const makeUpload = (subdir, allowedExts) => {
  const dest = path.join(__dirname, `../uploads/${subdir}`);
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const storage = multer.diskStorage({
    destination: dest,
    filename: (_req, file, cb) => {
      const rand = crypto.randomBytes(8).toString('hex');
      cb(null, `${rand}${path.extname(file.originalname)}`);
    },
  });
  const fileFilter = (_req, file, cb) => {
    const re = new RegExp(allowedExts.join('|'));
    const ok = re.test(path.extname(file.originalname).toLowerCase()) && re.test(file.mimetype);
    cb(ok ? null : new Error(`Only ${allowedExts.join(', ')} files allowed`), ok);
  };
  return multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
};

module.exports = makeUpload('receipts', ['jpeg', 'jpg', 'png', 'pdf']);
module.exports.cardImages = makeUpload('card-images', ['jpeg', 'jpg', 'png', 'webp', 'svg']);
module.exports.bankLogos = makeUpload('bank-logos', ['jpeg', 'jpg', 'png', 'webp', 'svg']);
