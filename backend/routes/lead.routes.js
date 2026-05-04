const router = require('express').Router();
const ctrl = require('../controllers/lead.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect);

// Agent
router.post('/', requireRole('agent'), ctrl.create);
router.get('/mine', requireRole('agent'), ctrl.listMine);
router.get('/stats', requireRole('agent'), ctrl.stats);
router.get('/ledger', requireRole('agent'), ctrl.myLedger);

// Agency
router.get('/agency', requireRole('agency'), ctrl.listForAgency);

// Admin
router.get('/', requireRole('admin'), ctrl.listAll);
router.post('/:id/mark-paid', requireRole('admin'), ctrl.markCommissionPaid);

// Agency or admin: status updates (controller checks ownership for agency)
router.patch('/:id/status', requireRole('agency', 'admin'), ctrl.updateStatus);

module.exports = router;
