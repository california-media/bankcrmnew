const router = require('express').Router();
const ctrl = require('../controllers/promotion.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect);

// Tiers: any authed role can list (admin sees inactive too); only admin manages.
router.get('/tiers', ctrl.listTiers);
router.post('/tiers', requireRole('admin'), ctrl.createTier);
router.put('/tiers/:id', requireRole('admin'), ctrl.updateTier);
router.delete('/tiers/:id', requireRole('admin'), ctrl.deleteTier);

// Agent's own progress for the Agent Panel "Promotion" tab.
router.get('/my-progress', requireRole('agent'), ctrl.myProgress);

// Admin fulfillment view.
router.get('/awards', requireRole('admin'), ctrl.adminOverview);
router.put('/awards/:id/status', requireRole('admin'), ctrl.updateAwardStatus);

// Calendar breakdown — "in which month did this agent do how many" — purely
// informational, has no bearing on lifetime tier eligibility.
router.get('/monthly-counts', requireRole('admin'), ctrl.monthlyCounts);

module.exports = router;
