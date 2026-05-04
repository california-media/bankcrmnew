const router = require('express').Router();
const ctrl = require('../controllers/agency.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect);

// Agent + admin: read-only lookup used by the lead form
router.get('/for-bank/:bankId', requireRole('agent', 'admin'), ctrl.listForBank);

// Admin only: agency management
router.post('/', requireRole('admin'), ctrl.create);
router.get('/', requireRole('admin'), ctrl.list);
router.post('/:id/resend-invite', requireRole('admin'), ctrl.resendInvite);

module.exports = router;
