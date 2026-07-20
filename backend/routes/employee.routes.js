const router = require('express').Router();
const ctrl = require('../controllers/employee.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect);

router.post('/', requireRole('agency'), ctrl.create);
router.get('/', requireRole('agency'), ctrl.list);
router.patch('/:id/toggle', requireRole('agency'), ctrl.toggleActive);
router.patch('/:id/password', requireRole('agency'), ctrl.updatePassword);
router.patch('/:id', requireRole('agency'), ctrl.update);
router.delete('/:id', requireRole('agency'), ctrl.remove);

module.exports = router;
