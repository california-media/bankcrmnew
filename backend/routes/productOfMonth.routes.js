const router = require('express').Router();
const ctrl = require('../controllers/productOfMonth.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/', protect, ctrl.getForAgent);

module.exports = router;
