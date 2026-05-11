const router = require('express').Router();
const ctrl = require('../controllers/employeeStatus.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/', requireRole('admin', 'agency', 'agent', 'employee'), ctrl.list);
router.post('/', requireRole('admin'), ctrl.create);
router.patch('/:id', requireRole('admin'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

module.exports = router;
