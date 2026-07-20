const router = require('express').Router();
const ctrl = require('../controllers/bank.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect);

// All authenticated roles: list all banks
router.get('/', requireRole('admin', 'agency', 'agent'), ctrl.list);

// Admin: bank CRUD
router.post('/', requireRole('admin'), upload.bankLogos.single('logo'), ctrl.create);
router.put('/:id', requireRole('admin'), upload.bankLogos.single('logo'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

module.exports = router;
