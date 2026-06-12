const http = require('http');
const https = require('https');

const WABA_API_URL  = process.env.WABA_API_URL  || 'https://nf6fp9tcn6.execute-api.eu-north-1.amazonaws.com/api/external/consent/send';
const WABA_API_KEY  = process.env.WABA_API_KEY  || '';
const TEMPLATE_NAME = process.env.WABA_TEMPLATE || 'consent_message';
const YES_BUTTON    = process.env.WABA_YES_BUTTON || 'YES';

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function sendConsentMessage({ phone, externalLeadId, customerName }) {
  return new Promise((resolve) => {
    if (!WABA_API_KEY) return resolve({ skipped: true, reason: 'WABA_API_KEY not set' });

    const normalized = normalizePhone(phone);
    if (!normalized) return resolve({ skipped: true, reason: 'no phone' });

    const payload = JSON.stringify({
      phone: normalized,
      externalLeadId: String(externalLeadId),
      templateName: TEMPLATE_NAME,
      yesButtonText: YES_BUTTON,
      params: {
        body: [customerName || 'Customer'],
      },
    });

    const url = new URL(WABA_API_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-api-key': WABA_API_KEY,
      },
    };

    console.log(`[WABA] Sending consent to phone=${normalized} externalLeadId=${externalLeadId} customer="${customerName || 'Customer'}"`);

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`[WABA] Response status=${res.statusCode} body=${JSON.stringify(parsed)}`);
          resolve({ status: res.statusCode, body: parsed });
        } catch (_) {
          console.log(`[WABA] Response status=${res.statusCode} body=${data}`);
          resolve({ status: res.statusCode, body: data });
        }
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

    req.write(payload);
    req.end();
  });
}

module.exports = { sendConsentMessage };
