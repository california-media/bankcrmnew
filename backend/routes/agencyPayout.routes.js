const router = require('express').Router();
const ctrl = require('../controllers/agencyPayout.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect);
router.use(requireRole('agency'));

router.get('/pending', ctrl.getPending);
router.get('/history', ctrl.getHistory);
router.get('/bucket', ctrl.getBucket);
router.post('/add-wallet', upload.single('receiptFile'), ctrl.addToWallet);
router.post('/', upload.single('receiptFile'), ctrl.submitPayout);

module.exports = router;
