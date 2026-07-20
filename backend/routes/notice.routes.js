const router = require('express').Router();
const ctrl   = require('../controllers/notice.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

// /active MUST come before /:id — otherwise Express matches "active" as an id param
router.get('/active', protect, ctrl.getActiveNotices);

router.use(protect, requireRole('admin'));
router.post('/',    ctrl.createNotice);
router.get('/',     ctrl.listNotices);
router.put('/:id',  ctrl.updateNotice);
router.delete('/:id', ctrl.deleteNotice);

module.exports = router;
