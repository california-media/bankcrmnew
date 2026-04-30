const router = require('express').Router();
const ctrl = require('../controllers/bank.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.get('/', protect, ctrl.list);
router.post('/', protect, requireRole('admin'), ctrl.create);
router.put('/:id', protect, requireRole('admin'), ctrl.update);
router.delete('/:id', protect, requireRole('admin'), ctrl.remove);

module.exports = router;
