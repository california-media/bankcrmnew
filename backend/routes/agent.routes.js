const router = require('express').Router();
const ctrl = require('../controllers/agent.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect);
router.use(requireRole('agency'));

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.patch('/:id/toggle', ctrl.toggleActive);

module.exports = router;
