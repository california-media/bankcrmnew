const router = require('express').Router();
const ctrl = require('../controllers/volumeBonus.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect);

router.get('/', ctrl.list);
router.post('/', requireRole('admin'), ctrl.create);
router.put('/:id', requireRole('admin'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

module.exports = router;
