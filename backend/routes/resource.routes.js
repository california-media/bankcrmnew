const router = require('express').Router();
const ctrl = require('../controllers/resource.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect);

// All authenticated roles can read (filtered by role inside the controller)
router.get('/', requireRole('admin', 'agent', 'agency', 'employee'), ctrl.list);

// Admin only for write
router.post('/', requireRole('admin'), upload.resources.single('file'), ctrl.create);
router.put('/:id', requireRole('admin'), upload.resources.single('file'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

module.exports = router;
