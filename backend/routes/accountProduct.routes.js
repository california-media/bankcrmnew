const router = require('express').Router();
const ctrl = require('../controllers/accountProduct.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect);

// All authenticated users can read (agents need it for lead creation)
router.get('/', requireRole('admin', 'agent', 'agency', 'employee'), ctrl.list);

// Admin only for write
router.post('/', requireRole('admin'), ctrl.create);
router.put('/:id', requireRole('admin'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

module.exports = router;
