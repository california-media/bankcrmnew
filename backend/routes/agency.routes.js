const router = require('express').Router();
const ctrl = require('../controllers/agency.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect, requireRole('admin'));

router.post('/', ctrl.create);
router.get('/', ctrl.list);
router.patch('/:id', ctrl.update);
router.patch('/:id/toggle-active', ctrl.toggleActive);
router.delete('/:id', ctrl.remove);
router.post('/:id/resend-invite', ctrl.resendInvite);

module.exports = router;
