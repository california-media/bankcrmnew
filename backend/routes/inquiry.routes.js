const router = require('express').Router();
const ctrl = require('../controllers/inquiry.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

// Public — inzigo-site form
router.post('/', ctrl.submit);

// Admin only
router.get('/', protect, requireRole('admin'), ctrl.list);
router.patch('/:id/read', protect, requireRole('admin'), ctrl.markRead);
router.delete('/:id', protect, requireRole('admin'), ctrl.deleteInquiry);

module.exports = router;
