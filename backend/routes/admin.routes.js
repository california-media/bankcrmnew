const router = require('express').Router();
const ctrl = require('../controllers/admin.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect, requireRole('admin'));

router.get('/agents', ctrl.listAgents);
router.get('/overview', ctrl.overview);

module.exports = router;
