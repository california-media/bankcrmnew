const router = require('express').Router();
const ctrl = require('../controllers/coins.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect, requireRole('agent'));

router.get('/me', ctrl.me);
router.get('/spin', ctrl.getSpin);
router.post('/spin', ctrl.postSpin);
router.get('/transactions', ctrl.transactions);
router.get('/vouchers', ctrl.vouchers);
router.post('/vouchers/:id/redeem', ctrl.redeem);
router.get('/redemptions', ctrl.redemptions);
router.patch('/redemptions/:id/scratch', ctrl.scratch);
router.get('/invites', ctrl.invites);

module.exports = router;
