const router = require('express').Router();
const ctrl = require('../controllers/employee.controller');
const { protect, allowEmployeeTypes } = require('../middleware/auth.middleware');

router.use(protect);

// Agency Coordinator ("all access except payment") manages employees the
// same as the agency owner — Account Access does not, matching its
// payment/reports-only scope.
router.post('/', allowEmployeeTypes('coordinator'), ctrl.create);
router.get('/', allowEmployeeTypes('coordinator'), ctrl.list);
router.patch('/:id/toggle', allowEmployeeTypes('coordinator'), ctrl.toggleActive);
router.patch('/:id/password', allowEmployeeTypes('coordinator'), ctrl.updatePassword);
router.patch('/:id', allowEmployeeTypes('coordinator'), ctrl.update);
router.delete('/:id', allowEmployeeTypes('coordinator'), ctrl.remove);

module.exports = router;
