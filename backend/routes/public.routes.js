const router = require('express').Router();
const ctrl = require('../controllers/public.controller');

router.get('/ref/:code', ctrl.getRefInfo);
router.post('/ref/:code/submit', ctrl.submitReferral);

module.exports = router;
