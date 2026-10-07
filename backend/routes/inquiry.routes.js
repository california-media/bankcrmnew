const router = require('express').Router();
const ctrl = require('../controllers/inquiry.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');
const { inquiryReplyFiles } = require('../middleware/upload.middleware');

// Multer errors (too big, wrong type, too many) as a 400 the UI can show.
const replyUpload = (req, res, next) =>
  inquiryReplyFiles.array('files', 10)(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Each attachment must be 10 MB or smaller'
      : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'You can attach up to 10 files'
      : err.message;
    res.status(400).json({ message });
  });

// Public — inzigo-site form
router.post('/', ctrl.submit);

// Super Admin (unscoped admin) only
const superAdminOnly = (req, res, next) =>
  (req.user.adminScope ? res.status(403).json({ message: 'Only the Super Admin can change SMTP settings' }) : next());
// Admin / Admin Coordinator
const replyStaffOnly = (req, res, next) =>
  (!req.user.adminScope || req.user.adminScope === 'coordinator' ? next() : res.status(403).json({ message: 'Forbidden' }));

router.get('/smtp-settings', protect, requireRole('admin'), superAdminOnly, ctrl.getSmtpSettings);
router.put('/smtp-settings', protect, requireRole('admin'), superAdminOnly, ctrl.updateSmtpSettings);

// Admin only
router.get('/', protect, requireRole('admin'), ctrl.list);
router.post('/:id/reply', protect, requireRole('admin'), replyStaffOnly, replyUpload, ctrl.reply);
router.patch('/:id/read', protect, requireRole('admin'), ctrl.markRead);
router.delete('/:id', protect, requireRole('admin'), ctrl.deleteInquiry);

module.exports = router;
