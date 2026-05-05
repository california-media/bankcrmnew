const router = require('express').Router();
const ctrl = require('../controllers/bank.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect);

// Agent + admin: every bank with agency labels (used by the new-lead form)
router.get('/all', requireRole('agent', 'admin'), ctrl.listAll);

// Agency: own banks
router.get('/', requireRole('agency'), ctrl.list);
router.post('/', requireRole('agency'), ctrl.create);
router.put('/:id', requireRole('agency'), ctrl.update);
router.delete('/:id', requireRole('agency'), ctrl.remove);

module.exports = router;
