const router = require('express').Router();
const ctrl = require('../controllers/cardProduct.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect);

// All authenticated users can read (agents need it for lead creation)
router.get('/', requireRole('admin', 'agent', 'agency'), ctrl.list);

// Admin only for write
router.post('/', requireRole('admin'), upload.cardImages.single('cardImage'), ctrl.create);
router.put('/:id', requireRole('admin'), upload.cardImages.single('cardImage'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

module.exports = router;
