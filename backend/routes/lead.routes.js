const router = require('express').Router();
const ctrl = require('../controllers/lead.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.post('/', protect, requireRole('agent'), ctrl.create);
router.get('/mine', protect, requireRole('agent'), ctrl.listMine);
router.get('/stats', protect, requireRole('agent'), ctrl.stats);

module.exports = router;
