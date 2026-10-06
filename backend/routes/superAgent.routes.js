const router = require('express').Router();
const ctrl = require('../controllers/superAgent.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect, requireRole('agent'));

router.get('/leads', ctrl.subAgentLeads);
router.get('/sub-agents', ctrl.subAgents);
router.get('/earnings', ctrl.earnings);

module.exports = router;
