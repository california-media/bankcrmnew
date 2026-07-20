const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/notification.controller');

router.get('/',      protect, ctrl.list);
router.patch('/read', protect, ctrl.markRead);

module.exports = router;
