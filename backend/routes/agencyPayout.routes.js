const router = require('express').Router();
const ctrl = require('../controllers/agencyPayout.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect);

// Admin: bucket request management
router.get('/admin/bucket-requests', requireRole('admin'), ctrl.adminGetBucketRequests);
router.patch('/admin/bucket-requests/:id/approve', requireRole('admin'), ctrl.approveBucketRequest);
router.patch('/admin/bucket-requests/:id/reject', requireRole('admin'), ctrl.rejectBucketRequest);

// Agency only
router.use(requireRole('agency'));
router.get('/pending', ctrl.getPending);
router.get('/history', ctrl.getHistory);
router.get('/bucket', ctrl.getBucket);
router.get('/bucket-requests', ctrl.getMyBucketRequests);
router.post('/add-wallet', upload.single('receiptFile'), ctrl.addToWallet);
router.post('/', upload.single('receiptFile'), ctrl.submitPayout);

module.exports = router;
