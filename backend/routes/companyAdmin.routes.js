const router = require('express').Router();
const ctrl = require('../controllers/company.controller');
const { protect, requireRole, requireSuperAdmin } = require('../middleware/auth.middleware');

router.use(protect, requireRole('admin'), requireSuperAdmin);
router.get('/', ctrl.list);
router.post('/bulk', ctrl.bulk);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
