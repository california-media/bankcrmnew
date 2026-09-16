const router = require('express').Router();
const ctrl = require('../controllers/invoice.controller');
const { protect, requireRole, allowEmployeeTypes } = require('../middleware/auth.middleware');

router.use(protect);

// Admin: create/manage invoices
router.post('/', requireRole('admin'), ctrl.create);
router.get('/suggest-leads', requireRole('admin'), ctrl.suggestFromLeads);
router.put('/:id/status', requireRole('admin'), ctrl.updateStatus);
router.delete('/:id', requireRole('admin'), ctrl.remove);

// Admin, or the billed agency (Account Access employee only — Coordinator
// excluded, same "all access except agent payment" rule as agency-payouts).
// allowEmployeeTypes only accepts role 'agency'/'employee', so admin needs
// its own bypass here rather than being folded into that check.
const adminOrAllowedAgency = (...types) => (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  return allowEmployeeTypes(...types)(req, res, next);
};
router.get('/', adminOrAllowedAgency('account'), ctrl.list);
router.get('/:id/pdf', adminOrAllowedAgency('account'), ctrl.downloadPdf);
router.get('/:id', adminOrAllowedAgency('account'), ctrl.getOne);

module.exports = router;
