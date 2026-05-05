const router = require('express').Router();
const ctrl = require('../controllers/bank.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect);

// Agency: own banks
router.get('/', requireRole('agency'), ctrl.list);
router.post('/', requireRole('agency'), ctrl.create);
router.put('/:id', requireRole('agency'), ctrl.update);
router.delete('/:id', requireRole('agency'), ctrl.remove);

// Agent + admin: read-only view of a specific agency's banks (used by send-to-agency flow)
router.get('/for-agency/:agencyId', requireRole('agent', 'admin'), ctrl.listForAgency);

module.exports = router;
