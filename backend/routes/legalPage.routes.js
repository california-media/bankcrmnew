const router = require('express').Router();
const { protect, requireRole } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/legalPage.controller');

router.get('/',        protect, requireRole('admin'), ctrl.list);
router.put('/:slug',   protect, requireRole('admin'), ctrl.update);
router.get('/:slug',   ctrl.getBySlug);

module.exports = router;
