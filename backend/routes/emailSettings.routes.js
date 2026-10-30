const router = require('express').Router();
const EmailSettings = require('../models/EmailSettings');
const { smtpSettingsHandlers } = require('../utils/smtpSettings');
const { protect, requireRole, requireSuperAdmin } = require('../middleware/auth.middleware');

// SMTP account for all app emails — Admin → Email Settings (Super Admin).
const handlers = smtpSettingsHandlers(EmailSettings);

router.use(protect, requireRole('admin'), requireSuperAdmin);
router.get('/', handlers.get);
router.put('/', handlers.update);

module.exports = router;
