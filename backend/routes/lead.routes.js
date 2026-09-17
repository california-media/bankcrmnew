const router = require('express').Router();
const ctrl = require('../controllers/lead.controller');
const { protect, requireRole, allowEmployeeTypes } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect);

// Agent
router.post('/', requireRole('agent'), ctrl.create);
router.get('/mine', requireRole('agent'), ctrl.listMine);
router.get('/stats', requireRole('agent'), ctrl.stats);
router.get('/ledger', requireRole('agent'), ctrl.myLedger);
router.delete('/:id', requireRole('agent'), ctrl.removeDraft);
router.patch('/:id/engagement-status', requireRole('agent'), ctrl.updateEngagementStatus);
router.patch('/:id/complete-referral', requireRole('agent'), ctrl.completeReferral);
router.patch('/:id/reference-no', requireRole('agent'), ctrl.updateReferenceNo);
router.patch('/:id/remarks', requireRole('admin', 'agency', 'employee'), ctrl.updateRemarks);
router.post('/:id/documents', requireRole('agent', 'admin', 'agency'), upload.leadDocuments.array('documents', 5), ctrl.addDocuments);

// All roles — add note
router.post('/:id/notes', requireRole('admin', 'agency', 'agent', 'employee'), ctrl.addNote);

// Agent + admin
router.post('/:id/send-to-agency', requireRole('agent', 'admin'), ctrl.sendToAgency);

// Employee
router.get('/assigned', requireRole('employee'), ctrl.listAssigned);
router.patch('/:id/employee-status', requireRole('employee', 'agency'), require('../controllers/employeeStatus.controller').setOnLead);
router.patch('/:id/consent-status',  requireRole('employee', 'agency', 'admin'), require('../controllers/employeeStatus.controller').setConsentOnLead);
router.patch('/:id/loan-status',     requireRole('admin', 'employee', 'agency'), require('../controllers/employeeStatus.controller').setLoanStatusOnLead);

// Admin + Agency — bulk import from Excel
router.post('/import', requireRole('admin', 'agency'), upload.leadImportFile.single('file'), ctrl.importLeads);

// Agency
router.get('/agency', allowEmployeeTypes('coordinator', 'account'), ctrl.listForAgency);
router.post('/bulk-assign-employee', allowEmployeeTypes('coordinator'), ctrl.bulkAssignEmployee);
router.post('/bulk-receipt', requireRole('agency'), upload.single('receiptFile'), ctrl.bulkAddReceipt);
router.patch('/:id/loan-amount', requireRole('agency', 'employee', 'admin'), ctrl.updateLoanAmount);
router.patch('/:id/product', requireRole('agency', 'employee', 'admin'), ctrl.updateProduct);
router.patch('/:id/cpv', requireRole('agency', 'employee', 'admin'), ctrl.updateCpv);
router.patch('/:id/activate', requireRole('agency', 'employee', 'admin'), ctrl.updateActivate);
router.patch('/:id/spend', requireRole('agency', 'employee', 'admin'), ctrl.updateSpend);
router.patch('/:id/pdc-chq', requireRole('agency', 'employee', 'admin'), ctrl.updatePdcChq);
router.patch('/:id/fresh-account-open', requireRole('agency', 'employee', 'admin'), ctrl.updateFreshAccountOpen);
router.patch('/:id/fresh-stl', requireRole('agency', 'employee', 'admin'), ctrl.updateFreshStl);
router.patch('/:id/buyout-account-open', requireRole('agency', 'employee', 'admin'), ctrl.updateBuyoutAccountOpen);
router.patch('/:id/buyout-ll-received', requireRole('agency', 'employee', 'admin'), ctrl.updateBuyoutLlReceived);
router.patch('/:id/buyout-mc-submitted', requireRole('agency', 'employee', 'admin'), ctrl.updateBuyoutMcSubmitted);
router.patch('/:id/buyout-cl-received', requireRole('agency', 'employee', 'admin'), ctrl.updateBuyoutClReceived);
router.patch('/:id/buyout-stl', requireRole('agency', 'employee', 'admin'), ctrl.updateBuyoutStl);
router.patch('/:id/sme-account-open', requireRole('agency', 'employee', 'admin'), ctrl.updateSmeAccountOpen);
router.patch('/:id/sme-buyout-account-open', requireRole('agency', 'employee', 'admin'), ctrl.updateSmeBuyoutAccountOpen);
router.patch('/:id/sme-buyout-ll', requireRole('agency', 'employee', 'admin'), ctrl.updateSmeBuyoutLl);
router.patch('/:id/sme-buyout-mc', requireRole('agency', 'employee', 'admin'), ctrl.updateSmeBuyoutMc);
router.patch('/:id/sme-buyout-cl', requireRole('agency', 'employee', 'admin'), ctrl.updateSmeBuyoutCl);
router.patch('/:id/pos-pdc', requireRole('agency', 'employee', 'admin'), ctrl.updatePosPdc);
router.patch('/:id/pos-dda', requireRole('agency', 'employee', 'admin'), ctrl.updatePosDda);
router.patch('/:id/pos-loan-account-open', requireRole('agency', 'employee', 'admin'), ctrl.updatePosLoanAccountOpen);
router.patch('/:id/car-loan-registration', requireRole('agency', 'employee', 'admin'), ctrl.updateCarLoanRegistration);
router.patch('/:id/mortgage-new-docs', requireRole('agency', 'employee', 'admin'), ctrl.updateMortgageNewDocs);
router.patch('/:id/mortgage-new-evaluation', requireRole('agency', 'employee', 'admin'), ctrl.updateMortgageNewEvaluation);
router.patch('/:id/mortgage-new-registration', requireRole('agency', 'employee', 'admin'), ctrl.updateMortgageNewRegistration);
router.patch('/:id/mortgage-buyout-docs', requireRole('agency', 'employee', 'admin'), ctrl.updateMortgageBuyoutDocs);
router.patch('/:id/mortgage-buyout-evaluation', requireRole('agency', 'employee', 'admin'), ctrl.updateMortgageBuyoutEvaluation);
router.patch('/:id/mortgage-buyout-ll', requireRole('agency', 'employee', 'admin'), ctrl.updateMortgageBuyoutLl);
router.patch('/:id/mortgage-buyout-mc', requireRole('agency', 'employee', 'admin'), ctrl.updateMortgageBuyoutMc);
router.patch('/:id/mortgage-buyout-cl', requireRole('agency', 'employee', 'admin'), ctrl.updateMortgageBuyoutCl);
router.patch('/:id/mortgage-buyout-registration', requireRole('agency', 'employee', 'admin'), ctrl.updateMortgageBuyoutRegistration);
router.patch('/:id/business-account-open', requireRole('agency', 'employee', 'admin'), ctrl.updateBusinessAccountOpen);
router.patch('/:id/business-account-fund-credited', requireRole('agency', 'employee', 'admin'), ctrl.updateBusinessAccountFundCredited);
router.patch('/:id/current-account-open', requireRole('agency', 'employee', 'admin'), ctrl.updateCurrentAccountOpen);
router.patch('/:id/current-account-salary-credited', requireRole('agency', 'employee', 'admin'), ctrl.updateCurrentAccountSalaryCredited);
router.patch('/:id/savings-account-open', requireRole('agency', 'employee', 'admin'), ctrl.updateSavingsAccountOpen);
router.patch('/:id/savings-fund-credited', requireRole('agency', 'employee', 'admin'), ctrl.updateSavingsFundCredited);
router.patch('/:id/receipt', requireRole('agency'), upload.single('receiptFile'), ctrl.addDisbursementReceipt);
router.patch('/:id/assign-employee', allowEmployeeTypes('coordinator'), ctrl.assignEmployee);

// Admin
router.get('/', requireRole('admin'), ctrl.listAll);
router.get('/holds', requireRole('admin'), ctrl.listHolds);
router.post('/bulk-mark-paid', requireRole('admin'), ctrl.bulkMarkPaid);
router.post('/pay-from-bucket-agent', requireRole('admin'), ctrl.payFromBucketAgent);
router.post('/pay-from-bucket-full', requireRole('admin'), ctrl.payFromBucketFull);
router.post('/bulk-mark-received', requireRole('admin'), ctrl.bulkMarkReceived);
router.post('/admin-pay-from-bucket', requireRole('admin'), ctrl.adminPayFromBucket);
router.post('/bulk-release-holds', requireRole('admin'), ctrl.bulkReleaseHolds);
router.post('/:id/mark-paid', requireRole('admin'), ctrl.markCommissionPaid);
router.post('/:id/release-hold', requireRole('admin'), ctrl.releaseHold);
router.patch('/:id/agent-commission', requireRole('admin'), ctrl.setAgentCommission);
router.delete('/:id/notes/:noteId', requireRole('admin'), ctrl.deleteNote);
router.delete('/:id/admin-delete', requireRole('admin'), ctrl.adminDeleteLead);

// Agency, admin, employee
router.patch('/:id/status', requireRole('agency', 'admin', 'employee'), ctrl.updateStatus);

// All roles — single lead detail (must be last to avoid shadowing named routes)
router.get('/:id', requireRole('admin', 'agency', 'agent', 'employee'), ctrl.getOne);

module.exports = router;
