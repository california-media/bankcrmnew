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
router.patch('/agents/:id/reset-password', ctrl.resetAgentPassword);
router.delete('/agents/:id', ctrl.deleteAgent);

router.post('/blog-editors', ctrl.createBlogEditor);
router.get('/blog-editors', ctrl.listBlogEditors);
router.put('/blog-editors/:id', ctrl.updateBlogEditor);
router.delete('/blog-editors/:id', ctrl.deleteBlogEditor);

router.get('/agencies/pending', ctrl.listPendingAgencies);
router.patch('/agencies/:id/approve', ctrl.approveAgency);
router.patch('/agencies/:id/reject', ctrl.rejectAgency);

router.post('/admins', ctrl.createAdminUser);
router.get('/admins', ctrl.listAdminUsers);
router.patch('/admins/:id', ctrl.updateAdminUser);
router.patch('/admins/:id/toggle-active', ctrl.toggleAdminUserActive);
router.patch('/admins/:id/reset-password', ctrl.resetAdminUserPassword);
router.delete('/admins/:id', ctrl.deleteAdminUser);

router.post('/agency-employees', ctrl.createAgencyEmployee);
router.get('/agency-employees', ctrl.listAgencyEmployees);
router.patch('/agency-employees/:id', ctrl.updateAgencyEmployee);
router.patch('/agency-employees/:id/toggle-active', ctrl.toggleAgencyEmployeeActive);
router.patch('/agency-employees/:id/reset-password', ctrl.resetAgencyEmployeePassword);
router.delete('/agency-employees/:id', ctrl.deleteAgencyEmployee);

module.exports = router;
