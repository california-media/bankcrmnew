const router = require('express').Router();
const ctrl = require('../controllers/public.controller');
const blogCtrl = require('../controllers/blog.controller');
const catCtrl  = require('../controllers/blogCategory.controller');

router.get('/card-categories', require('../controllers/cardCategory.controller').list);
router.get('/ref/:code', ctrl.getRefInfo);
// Agent invite links (app.mysilah.ae/join/<code>): tap record + the app's first-launch match.
const inviteCtrl = require('../controllers/inviteClick.controller');
router.post('/invite-clicks', inviteCtrl.click);
router.post('/invite-clicks/match', inviteCtrl.match);
router.post('/ref/:code/draft', ctrl.draftReferral);
router.post('/ref/:code/submit', ctrl.submitReferral);
router.get('/track-status', ctrl.trackStatus);
router.post('/apply', ctrl.submitWebApply);
router.post('/loan-apply', ctrl.submitWebLoanApply);
router.post('/account-apply', ctrl.submitWebAccountApply);
router.get('/banks', ctrl.getPublicBanks);
router.get('/card-products', ctrl.getPublicCardProducts);
router.get('/loan-products', ctrl.getPublicLoanProducts);
router.get('/account-products', ctrl.getPublicAccountProducts);
router.get('/featured-products', ctrl.getPublicFeaturedProducts);
router.get('/blogs', blogCtrl.listPublic);
router.get('/blogs/:slug', blogCtrl.getBySlug);
router.get('/blog-categories', catCtrl.list);

module.exports = router;
