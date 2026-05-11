const router = require('express').Router();
const ctrl = require('../controllers/bank.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect);

// All authenticated roles: list all banks
router.get('/', requireRole('admin', 'agency', 'agent'), ctrl.list);

// Admin: bank CRUD
router.post('/', requireRole('admin'), ctrl.create);
router.put('/:id', requireRole('admin'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

module.exports = router;
