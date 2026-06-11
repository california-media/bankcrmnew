const http = require('http');
const https = require('https');

const WABA_API_URL  = process.env.WABA_API_URL  || 'http://localhost:4004/api/external/consent/send';
const WABA_API_KEY  = process.env.WABA_API_KEY  || '';
const TEMPLATE_NAME = process.env.WABA_TEMPLATE || 'thankyou';
const YES_BUTTON    = process.env.WABA_YES_BUTTON || 'YES';

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function sendConsentMessage({ phone, externalLeadId }) {
  return new Promise((resolve, reject) => {
    if (!WABA_API_KEY) return resolve({ skipped: true, reason: 'WABA_API_KEY not set' });

    const normalized = normalizePhone(phone);
    if (!normalized) return resolve({ skipped: true, reason: 'no phone' });

    const body = JSON.stringify({
      phone: normalized,
      externalLeadId: String(externalLeadId),
      templateName: TEMPLATE_NAME,
      yesButtonText: YES_BUTTON,
    });

    const url = new URL(WABA_API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': WABA_API_KEY,
      },
    };

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (_) { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on('error', (err) => {
      console.error('[WABA] request error:', err.message);
      resolve({ error: err.message });
    });

    req.setTimeout(8000, () => {
      req.destroy();
      resolve({ error: 'timeout' });
    });

    req.write(body);
    req.end();
  });
}

module.exports = { sendConsentMessage };
