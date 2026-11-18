const router = require('express').Router();
const ctrl = require('../controllers/loanProduct.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect);

// All authenticated users can read (agents need it for lead creation)
router.get('/', requireRole('admin', 'agent', 'agency', 'employee'), ctrl.list);

// Admin only for write
router.post('/', requireRole('admin'), ctrl.create);
router.put('/:id', requireRole('admin'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

// Product picture — sent on its own after the product is saved
router.post('/:id/image', requireRole('admin'), upload.loanImages.single('image'), ctrl.uploadImage);
router.delete('/:id/image', requireRole('admin'), ctrl.removeImage);

module.exports = router;
