const router = require('express').Router();
const { protect, requireRole } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/legalPage.controller');

router.get('/',        protect, requireRole('admin'), ctrl.list);
router.get('/clawback/status',  protect, ctrl.clawbackStatus);
router.post('/clawback/accept', protect, requireRole('agent', 'agency'), ctrl.clawbackAccept);
router.put('/:slug',   protect, requireRole('admin'), ctrl.update);
router.get('/:slug',   ctrl.getBySlug);

module.exports = router;
