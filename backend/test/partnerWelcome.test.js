const test = require('node:test'); const assert = require('node:assert/strict');
const { firstName } = require('../utils/coinsShape');

test('firstName', () => {
  assert.equal(firstName('Omar Khan'), 'Omar');
  assert.equal(firstName('HAFIZ,MUHAMMAD,QAMAR,,,'), 'Hafiz');
  assert.equal(firstName('  maya '), 'maya');
  assert.equal(firstName(undefined), '');
});

test('partner welcome email shows the name and code, with the name escaped', () => {
  const { partnerWelcomeHtml, partnerWelcomeText, partnerWelcomeSubject } = require('../utils/partnerWelcomeEmail');
  const html = partnerWelcomeHtml({ name: 'Omar <b>', code: 'A3F91C2E', appUrl: 'https://app.mysilah.ae' });
  assert.match(html, /Welcome aboard, Omar &lt;b&gt;!/);
  assert.match(html, /A3F91C2E/);
  assert.match(html, /cid:logo/);
  assert.match(html, /cid:qr/);
  assert.match(html, /href="https:\/\/app\.mysilah\.ae\/terms"/);
  assert.match(partnerWelcomeText({ name: 'Omar', code: 'A3F91C2E', appUrl: 'https://app.mysilah.ae' }), /Your partner code: A3F91C2E/);
  assert.equal(partnerWelcomeSubject({ name: 'Omar' }), 'Welcome aboard, Omar! Your MySilah partner code');
});
