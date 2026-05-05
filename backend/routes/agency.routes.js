const router = require('express').Router();
const ctrl = require('../controllers/agency.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect);

// Agent + admin: lightweight active list, used by send-to-agency
router.get('/active', requireRole('agent', 'admin'), ctrl.listActive);

// Admin only
router.post('/', requireRole('admin'), ctrl.create);
router.get('/', requireRole('admin'), ctrl.list);
router.post('/:id/resend-invite', requireRole('admin'), ctrl.resendInvite);

module.exports = router;
