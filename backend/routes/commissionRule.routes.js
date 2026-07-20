const router = require('express').Router();
const ctrl = require('../controllers/commissionRule.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect, requireRole('agency'));

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
