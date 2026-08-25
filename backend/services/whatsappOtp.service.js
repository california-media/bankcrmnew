const https = require('https');
const { META_GRAPH_URL } = require('../config/whatsapp');

function sendWhatsAppOtp({ phone, otp }) {
  return new Promise((resolve) => {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!phoneNumberId || !accessToken) {
      return resolve({ error: 'WhatsApp credentials not configured' });
    }

    const payload = JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: 'otp',
        language: { code: 'en_US' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: otp }] },
          {
            type: 'button',
            sub_type: 'url',
            index: 0,
            parameters: [{ type: 'text', text: otp }],
          },
        ],
      },
    });

    const url = new URL(`${META_GRAPH_URL}/${phoneNumberId}/messages`);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        Authorization: `Bearer ${accessToken}`,
      },
    };

    console.log(`[WhatsApp OTP] Sending OTP to phone=${phone}`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`[WhatsApp OTP] Response status=${res.statusCode} body=${JSON.stringify(parsed)}`);
          resolve({ status: res.statusCode, body: parsed });
        } catch (_) {
          console.log(`[WhatsApp OTP] Response status=${res.statusCode} body=${data}`);
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[WhatsApp OTP] request error:', err.message);
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

module.exports = { sendWhatsAppOtp };
