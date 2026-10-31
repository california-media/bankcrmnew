const router = require('express').Router();
const ctrl = require('../controllers/welcomeEmail.controller');
const upload = require('../middleware/upload.middleware');
const { protect, requireRole, requireSuperAdmin } = require('../middleware/auth.middleware');

// Partner welcome email design — Admin → Email Settings → Welcome Email (Super Admin).
router.use(protect, requireRole('admin'), requireSuperAdmin);
router.get('/', ctrl.get);
router.put('/', ctrl.update);
router.post('/preview', ctrl.preview);
router.post('/test', ctrl.sendTest);
router.post('/image', upload.emailImages.single('image'), ctrl.uploadImage);
router.post('/attachment', upload.emailAttachments.single('file'), ctrl.uploadAttachment);

module.exports = router;
