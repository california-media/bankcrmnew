const express = require('express');
const router  = express.Router();
const { wabaConsent } = require('../controllers/webhook.controller');

// POST /api/webhooks/waba-consent
// Called by WABA service when customer taps YES on consent message
router.post('/waba-consent', wabaConsent);

module.exports = router;
