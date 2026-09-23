const router = require('express').Router();
const ctrl = require('../controllers/companySettings.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect, requireRole('admin'));

router.get('/', ctrl.get);
router.put('/', ctrl.update);

module.exports = router;
