const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const uaepass = require('../controllers/uaepass.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/uaepass/init', uaepass.init);
router.get('/uaepass/callback', uaepass.callback);
router.get('/uaepass/link-init', protect, uaepass.linkInit);
router.post('/uaepass/unlink', protect, uaepass.unlink);

router.post('/register-agent', ctrl.registerAgent);
router.post('/send-otp', ctrl.sendOtp);
router.post('/verify-otp', ctrl.verifyOtp);
router.get('/verify-email/:token', ctrl.verifyEmail);
router.post('/register-agency', ctrl.registerAgency);
router.post('/login', ctrl.login);
router.get('/invite/:token', ctrl.verifyInvite);
router.post('/set-password', ctrl.setPassword);
router.get('/me', protect, ctrl.me);
router.get('/profile', protect, ctrl.getProfile);
router.patch('/profile', protect, ctrl.updateProfile);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);
router.delete('/account', protect, ctrl.deleteAccount);

module.exports = router;
