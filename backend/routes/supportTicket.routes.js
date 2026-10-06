const router = require('express').Router();
const ctrl = require('../controllers/supportTicket.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect);

router.get('/', ctrl.list);
router.post('/', upload.supportFiles.array('files', 5), ctrl.create);
router.get('/:id', ctrl.getOne);
router.post('/:id/messages', upload.supportFiles.array('files', 5), ctrl.reply);
router.patch('/:id/status', requireRole('admin'), ctrl.setStatus);

module.exports = router;
