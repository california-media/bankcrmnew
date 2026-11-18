const router = require('express').Router();
const ctrl = require('../controllers/saraVideo.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

// Admin Promotions > Sara Guide. The app reads GET /api/public/guide-videos instead.
router.use(protect, requireRole('admin'));
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
