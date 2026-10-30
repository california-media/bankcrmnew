const router = require('express').Router();
const ctrl = require('../controllers/company.controller');

// Public — the client referral-link form has no login.
router.get('/', ctrl.search);

module.exports = router;
