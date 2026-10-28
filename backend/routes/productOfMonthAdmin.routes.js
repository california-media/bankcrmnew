const router = require('express').Router();
const ctrl = require('../controllers/productOfMonth.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect, requireRole('admin'));
router.get('/', ctrl.getAdmin);
router.put('/', ctrl.updateAdmin);

module.exports = router;
