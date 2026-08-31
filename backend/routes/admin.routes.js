const router = require('express').Router();
const ctrl = require('../controllers/admin.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');

router.use(protect, requireRole('admin'));

router.get('/agents', ctrl.listAgents);
router.get('/agents/:id', ctrl.getAgent);
router.get('/overview', ctrl.overview);
router.post('/agents', ctrl.createAgent);
router.patch('/agents/:id', ctrl.updateAgent);
router.patch('/agents/:id/toggle-active', ctrl.toggleAgentActive);
router.delete('/agents/:id', ctrl.deleteAgent);

router.post('/blog-editors', ctrl.createBlogEditor);
router.get('/blog-editors', ctrl.listBlogEditors);
router.put('/blog-editors/:id', ctrl.updateBlogEditor);
router.delete('/blog-editors/:id', ctrl.deleteBlogEditor);

router.get('/agencies/pending', ctrl.listPendingAgencies);
router.patch('/agencies/:id/approve', ctrl.approveAgency);
router.patch('/agencies/:id/reject', ctrl.rejectAgency);

module.exports = router;
