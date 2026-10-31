const router = require('express').Router();
const ctrl = require('../controllers/company.controller');
const { optionalAuth } = require('../middleware/auth.middleware');

// Public — the client referral-link form has no login. Signed-in admin /
// agency users also get each company's category, bank and notes.
router.get('/', optionalAuth, ctrl.search);

module.exports = router;
