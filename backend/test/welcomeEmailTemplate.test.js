const test = require('node:test'); const assert = require('node:assert/strict');
const {
  fillFields, emailSafeBody, welcomeFieldValues, customWelcomeEmail, WELCOME_FIELDS,
} = require('../utils/partnerWelcomeEmail');

const appUrl = 'https://app.mysilah.ae';
const values = welcomeFieldValues({
  name: 'Omar Khan', email: 'omar@x.ae', phone: '971501234567', referralCode: 'A3F91C2E', superAgentCode: '',
}, appUrl);

test('field values come from the partner', () => {
  assert.equal(values.name, 'Omar');
  assert.equal(values.full_name, 'Omar Khan');
  assert.equal(values.referral_code, 'A3F91C2E');
  assert.equal(values.referral_link, 'https://app.mysilah.ae/ref/A3F91C2E');
  assert.equal(values.sign_in_link, 'https://app.mysilah.ae');
  assert.equal(values.super_agent_code, '');
  assert.deepEqual(WELCOME_FIELDS.map((f) => f.key).sort(), Object.keys(values).sort());
});

test('fillFields replaces known fields, tolerates spaces and URL-encoded braces, leaves unknown ones', () => {
  assert.equal(fillFields('Hi {{name}}, code {{ referral_code }} {{nope}}', values), 'Hi Omar, code A3F91C2E {{nope}}');
  assert.equal(fillFields('<a href="%7B%7Breferral_link%7D%7D">x</a>', values, true), '<a href="https://app.mysilah.ae/ref/A3F91C2E">x</a>');
});

test('fillFields escapes values for HTML when asked', () => {
  assert.equal(fillFields('{{name}}', { ...values, name: 'Omar <b>' }, true), 'Omar &lt;b&gt;');
  assert.equal(fillFields('{{name}}', { ...values, name: 'Omar <b>' }), 'Omar <b>');
});

test('emailSafeBody turns editor classes into inline styles and fixes spaces', () => {
  const out = emailSafeBody('<p class="ql-align-center">Hello&nbsp;there</p><img src="https://x/y.png">');
  assert.equal(out, '<p style="text-align:center;">Hello there</p><img style="max-width:100%;height:auto;" src="https://x/y.png">');
});

test('customWelcomeEmail wraps the body in the branded frame', () => {
  const msg = customWelcomeEmail({ subject: 'Welcome {{name}}', bodyHtml: '<h2>Hi {{name}}</h2><p>Code: {{referral_code}}</p>' }, values, appUrl);
  assert.equal(msg.subject, 'Welcome Omar');
  assert.match(msg.html, /cid:logo/);
  assert.match(msg.html, /<h2>Hi Omar<\/h2>/);
  assert.match(msg.html, /href="https:\/\/app\.mysilah\.ae\/privacy"/);
  assert.doesNotMatch(msg.html, /cid:qr/);
  assert.match(msg.text, /Hi Omar\s+Code: A3F91C2E/);
});

test('admin attachments become email attachments fetched from their link', () => {
  const { welcomeAttachments, validWelcomeAttachments } = require('../utils/partnerWelcomeEmail');
  const list = [{ name: 'Guide.pdf', url: 'https://mysilah.s3.us-east-1.amazonaws.com/email-attachments/ab.pdf', size: 1000, contentType: 'application/pdf' }];
  assert.deepEqual(welcomeAttachments(list), [{ filename: 'Guide.pdf', path: list[0].url }]);
  assert.deepEqual(welcomeAttachments(undefined), []);
  assert.equal(validWelcomeAttachments(list), null);
  assert.match(validWelcomeAttachments(Array(6).fill(list[0])), /5 attachments/);
  assert.match(validWelcomeAttachments([{ ...list[0], url: 'http://evil.example/x.pdf' }]), /link/);
  assert.match(validWelcomeAttachments([{ ...list[0], size: 21 * 1024 * 1024 }]), /20 MB/);
});
