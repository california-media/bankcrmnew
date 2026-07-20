const multer    = require('multer');
const multerS3  = require('multer-s3');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path      = require('path');
const crypto    = require('crypto');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId:     process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_ACCESS,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET || 'mysilah';

const getFilename = (file) =>
  file.key ? path.basename(file.key) : file.filename;

const deleteFromS3 = (subdir, filename) => {
  if (!filename) return;
  const key = `${subdir}/${filename}`;
  s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => {});
};

const makeUpload = (subdir, allowedExts) => {
  const storage = multerS3({
    s3,
    bucket: BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req, file, cb) => {
      const rand = crypto.randomBytes(8).toString('hex');
      const ext  = path.extname(file.originalname).toLowerCase();
      cb(null, `${subdir}/${rand}${ext}`);
    },
  });

  const fileFilter = (_req, file, cb) => {
    const re = new RegExp(allowedExts.join('|'));
    const ok = re.test(path.extname(file.originalname).toLowerCase()) && re.test(file.mimetype);
    cb(ok ? null : new Error(`Only ${allowedExts.join(', ')} files allowed`), ok);
  };

  return multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
};

module.exports                    = makeUpload('receipts',             ['jpeg', 'jpg', 'png', 'pdf']);
module.exports.cardImages         = makeUpload('card-images',          ['jpeg', 'jpg', 'png', 'webp', 'svg', 'avif']);
module.exports.bankLogos          = makeUpload('bank-logos',           ['jpeg', 'jpg', 'png', 'webp', 'svg']);
module.exports.blogImages         = makeUpload('blog-images',          ['jpeg', 'jpg', 'png', 'webp', 'avif']);
module.exports.blogCategoryImages = makeUpload('blog-category-images', ['jpeg', 'jpg', 'png', 'webp', 'avif']);
module.exports.leadDocuments      = makeUpload('lead-documents',       ['jpeg', 'jpg', 'png', 'pdf']);

// In-memory upload for the leads bulk-import spreadsheet — parsed immediately, never persisted to S3.
module.exports.leadImportFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const ok = ['.xlsx', '.xls'].includes(ext);
    cb(ok ? null : new Error('Only .xlsx or .xls files allowed'), ok);
  },
});
// Helpers added after the module.exports reassignment so they aren't overwritten
module.exports.getFilename  = getFilename;
module.exports.deleteFromS3 = deleteFromS3;
