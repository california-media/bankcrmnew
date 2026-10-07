const multer    = require('multer');
const multerS3  = require('multer-s3');
const { S3Client, DeleteObjectCommand, CopyObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
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

const copyInS3 = async (subdir, filename) => {
  if (!filename) return undefined;
  const rand = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(filename);
  const newFilename = `${rand}${ext}`;
  await s3.send(new CopyObjectCommand({
    Bucket: BUCKET,
    CopySource: `${BUCKET}/${subdir}/${filename}`,
    Key: `${subdir}/${newFilename}`,
  }));
  return newFilename;
};

const makeUpload = (subdir, allowedExts, { checkMime = true } = {}) => {
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
    const ok = re.test(path.extname(file.originalname).toLowerCase()) && (!checkMime || re.test(file.mimetype));
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
module.exports.featuredProductImages = makeUpload('featured-products', ['jpeg', 'jpg', 'png', 'webp', 'avif']);
module.exports.avatars            = makeUpload('avatars',              ['jpeg', 'jpg', 'png', 'webp']);
module.exports.resources          = makeUpload('resources',            ['jpeg', 'jpg', 'png', 'pdf']);
module.exports.bankDocs           = makeUpload('bank-docs',            ['jpeg', 'jpg', 'png', 'pdf']);
// Support-ticket attachments: photos, PDFs and office docs (docx/xlsx mimetypes don't contain the extension, so skip the mime check)
module.exports.supportFiles       = makeUpload('support-files',        ['jpeg', 'jpg', 'png', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'], { checkMime: false });

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
// Request-reply email attachments: kept in memory so they can be attached to
// the outgoing email first, then stored to S3 (putToS3) only once it's sent.
const INQUIRY_REPLY_EXTS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.ppt', '.pptx', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.zip'];
module.exports.INQUIRY_REPLY_EXTS = INQUIRY_REPLY_EXTS;
module.exports.inquiryReplyFiles = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const ok = INQUIRY_REPLY_EXTS.includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error(`"${file.originalname}" is not an allowed file type`), ok);
  },
});

// Stores an in-memory multer file under subdir/ and returns the new filename.
// Downloads keep the original file name via Content-Disposition.
const { detectMimeType } = require('nodemailer/lib/mime-funcs');
// Browsers sometimes send a blank/generic type (e.g. .csv on Windows) — fall back to the extension.
const fileMimeType = (file) =>
  (file.mimetype && file.mimetype !== 'application/octet-stream' ? file.mimetype : detectMimeType(file.originalname));
module.exports.fileMimeType = fileMimeType;

const putToS3 = async (subdir, file) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const filename = `${crypto.randomBytes(8).toString('hex')}${ext}`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: `${subdir}/${filename}`,
    Body: file.buffer,
    ContentType: fileMimeType(file),
    ContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(file.originalname)}`,
  }));
  return filename;
};

// Helpers added after the module.exports reassignment so they aren't overwritten
module.exports.putToS3      = putToS3;
module.exports.getFilename  = getFilename;
module.exports.deleteFromS3 = deleteFromS3;
module.exports.copyInS3     = copyInS3;
