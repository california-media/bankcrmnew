const router = require('express').Router();
const ctrl = require('../controllers/company.controller');
const { optionalAuth, protect, requireRole } = require('../middleware/auth.middleware');

// Public — the client referral-link form has no login. Signed-in admin /
// agency users also get each company's category, bank and notes.
router.get('/', optionalAuth, ctrl.search);
// Lead detail: a company's banks, categories and notes.
router.get('/details', protect, requireRole('admin', 'agency', 'employee'), ctrl.details);

module.exports = router;
