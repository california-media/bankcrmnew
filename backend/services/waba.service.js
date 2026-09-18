const http = require('http');
const https = require('https');

const WABA_API_URL  = process.env.WABA_API_URL  || 'https://nf6fp9tcn6.execute-api.eu-north-1.amazonaws.com/api/external/consent/send1';
const WABA_API_KEY  = process.env.WABA_API_KEY  || '';
const TEMPLATE_NAME = process.env.WABA_TEMPLATE || 'consent_message';
const YES_BUTTON    = process.env.WABA_YES_BUTTON || 'YES';
// Where Voycell POSTs the customer's reply back to us. Must be a publicly
// reachable URL — Voycell (a cloud service) can never reach localhost, so
// this only actually works from the deployed backend.
const WABA_CALLBACK_URL = process.env.WABA_CALLBACK_URL || 'https://api.mysilah.ae/api/webhooks/waba-consent';

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

const PRODUCT_LABELS = { credit_card: 'Credit Card', loan: 'Loan', account: 'Bank Account' };

function sendConsentMessage({ phone, externalLeadId, customerName, productType }) {
  return new Promise((resolve) => {
    if (!WABA_API_KEY) return resolve({ skipped: true, reason: 'WABA_API_KEY not set' });

    const normalized = normalizePhone(phone);
    if (!normalized) return resolve({ skipped: true, reason: 'no phone' });

    const productLabel = PRODUCT_LABELS[productType];

    // NOTE: this deployed endpoint's own validation error names
    // `externalLeadId` as the required field (confirmed live) — it does
    // NOT match the `bankLeadId` naming documented in Voycell's own
    // integration plan for /api/external/consent/send. That plan describes
    // a different (or newer) contract than what's actually live here.
    // Only the CALLBACK direction (Voycell -> our webhook) is confirmed to
    // use `bankLeadId` — see webhook.controller.js.
    const payload = JSON.stringify({
      phone: normalized,
      name: customerName || undefined,
      externalLeadId: String(externalLeadId),
      templateName: TEMPLATE_NAME,
      callbackUrl: WABA_CALLBACK_URL,
      yesButtonText: YES_BUTTON,
      params: {
        // Second value only added once a product type is known — keeps this
        // call safe to ship before the WhatsApp template itself has a
        // second {{}} placeholder approved. Once it does, this always
        // sends two values (every lead has a productType).
        body: productLabel
          ? [customerName || 'Customer', productLabel]
          : [customerName || 'Customer'],
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

    console.log(`[WABA] Sending consent to phone=${normalized} externalLeadId=${externalLeadId} customer="${customerName || 'Customer'}" product="${productLabel || 'n/a'}"`);

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
