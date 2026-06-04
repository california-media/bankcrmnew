const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const uaepass = require('../controllers/uaepass.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/uaepass/init', uaepass.init);
router.get('/uaepass/callback', uaepass.callback);

router.post('/register-agent', ctrl.registerAgent);
router.post('/register-agency', ctrl.registerAgency);
router.post('/login', ctrl.login);
router.get('/invite/:token', ctrl.verifyInvite);
router.post('/set-password', ctrl.setPassword);
router.get('/me', protect, ctrl.me);
router.get('/profile', protect, ctrl.getProfile);
router.patch('/profile', protect, ctrl.updateProfile);

module.exports = router;
