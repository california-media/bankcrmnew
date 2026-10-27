const router = require('express').Router();
const ctrl = require('../controllers/coinsAdmin.controller');
const { protect, requireRole, requireSuperAdmin } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// Multer errors (too big, wrong type) as a 400 the UI can show.
const wrapUpload = (mw) => (req, res, next) =>
  mw(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large'
      : err.code === 'LIMIT_UNEXPECTED_FILE' ? 'Unexpected file field'
      : err.message;
    res.status(400).json({ message });
  });

const logoUpload = wrapUpload(upload.voucherLogos.single('logo'));
const codesUpload = wrapUpload(upload.leadImportFile.single('file'));

router.use(protect, requireRole('admin'), requireSuperAdmin);

router.get('/settings', ctrl.getSettings);
router.put('/settings', ctrl.updateSettings);

router.get('/vouchers', ctrl.listVouchers);
router.post('/vouchers', logoUpload, ctrl.createVoucher);
router.put('/vouchers/:id', logoUpload, ctrl.updateVoucher);
router.delete('/vouchers/:id', ctrl.deleteVoucher);
router.post('/vouchers/:id/codes', codesUpload, ctrl.addCodes);

router.get('/redemptions', ctrl.listRedemptions);

module.exports = router;
