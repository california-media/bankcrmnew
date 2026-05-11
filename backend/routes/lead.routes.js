const router = require('express').Router();
const ctrl = require('../controllers/lead.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect);

// Agent
router.post('/', requireRole('agent'), ctrl.create);
router.get('/mine', requireRole('agent'), ctrl.listMine);
router.get('/stats', requireRole('agent'), ctrl.stats);
router.get('/ledger', requireRole('agent'), ctrl.myLedger);
router.delete('/:id', requireRole('agent'), ctrl.removeDraft);
router.patch('/:id/engagement-status', requireRole('agent'), ctrl.updateEngagementStatus);

// All roles — add note
router.post('/:id/notes', requireRole('admin', 'agency', 'agent', 'employee'), ctrl.addNote);

// Agent + admin
router.post('/:id/send-to-agency', requireRole('agent', 'admin'), ctrl.sendToAgency);

// Employee
router.get('/assigned', requireRole('employee'), ctrl.listAssigned);
router.patch('/:id/employee-status', requireRole('employee'), require('../controllers/employeeStatus.controller').setOnLead);

// Agency
router.get('/agency', requireRole('agency'), ctrl.listForAgency);
router.post('/bulk-assign-employee', requireRole('agency'), ctrl.bulkAssignEmployee);
router.post('/bulk-receipt', requireRole('agency'), upload.single('receiptFile'), ctrl.bulkAddReceipt);
router.patch('/:id/loan-amount', requireRole('agency'), ctrl.updateLoanAmount);
router.patch('/:id/receipt', requireRole('agency'), upload.single('receiptFile'), ctrl.addDisbursementReceipt);
router.patch('/:id/assign-employee', requireRole('agency'), ctrl.assignEmployee);

// Admin
router.get('/', requireRole('admin'), ctrl.listAll);
router.post('/bulk-mark-paid', requireRole('admin'), ctrl.bulkMarkPaid);
router.post('/:id/mark-paid', requireRole('admin'), ctrl.markCommissionPaid);
router.patch('/:id/agent-commission', requireRole('admin'), ctrl.setAgentCommission);
router.delete('/:id/notes/:noteId', requireRole('admin'), ctrl.deleteNote);

// Agency, admin, employee
router.patch('/:id/status', requireRole('agency', 'admin', 'employee'), ctrl.updateStatus);

// All roles — single lead detail (must be last to avoid shadowing named routes)
router.get('/:id', requireRole('admin', 'agency', 'agent', 'employee'), ctrl.getOne);

module.exports = router;
