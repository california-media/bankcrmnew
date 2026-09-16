const router = require('express').Router();
const ctrl = require('../controllers/creditNote.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect);
router.use(requireRole('admin'));

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.put('/:id/status', ctrl.updateStatus);
router.delete('/:id', ctrl.remove);

module.exports = router;
