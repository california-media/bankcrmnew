const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');
const zlib = require('node:zlib');
const { resolveVatNote, resolveNotesLines, renderInvoicePdf } = require('../services/invoicePdf.service');

const DEFAULT = 'Since Silah is a newly established company, our VAT registration is currently under process.';

test('VAT note: admin cleared the box → no note on the invoice', () => {
  assert.equal(resolveVatNote({ vatNote: '' }), '');
});

test('VAT note: only spaces / new lines → treated as empty', () => {
  assert.equal(resolveVatNote({ vatNote: '   \n  ' }), '');
});

test('VAT note: admin typed a note → that note', () => {
  assert.equal(resolveVatNote({ vatNote: 'TRN 100000000000003' }), 'TRN 100000000000003');
});

test('VAT note: never set / no settings → old default sentence', () => {
  assert.equal(resolveVatNote({}), DEFAULT);
  assert.equal(resolveVatNote({ vatNote: null }), DEFAULT);
  assert.equal(resolveVatNote(undefined), DEFAULT);
});

test('Notes lines: blank lines are dropped, typed lines kept in order', () => {
  assert.deepEqual(resolveNotesLines({ notesLines: ['Pay in 30 days', '', '  ', 'Quote invoice no.'] }), ['Pay in 30 days', 'Quote invoice no.']);
});

test('Notes lines: admin removed every line → no lines (old defaults do not come back)', () => {
  assert.deepEqual(resolveNotesLines({ notesLines: [] }), []);
  assert.deepEqual(resolveNotesLines({ notesLines: [''] }), []);
});

test('Notes lines: never set / no settings → default lines', () => {
  assert.equal(resolveNotesLines({}).length, 4);
  assert.equal(resolveNotesLines(undefined).length, 4);
});

// Render the real PDF and read its text back, to prove the old sentence is gone.
const pdfText = (settings) => new Promise((resolve) => {
  const res = new PassThrough();
  res.setHeader = () => {};
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => {
    const raw = Buffer.concat(chunks).toString('latin1');
    let content = '';
    for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
      try { content += zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1'); } catch { /* not a content stream */ }
    }
    // Each text-show op is `[<hex> kern <hex> ...] TJ`; join its hex pieces back into one string.
    const lines = [...content.matchAll(/\[([^\]]*)\]\s*TJ/g)].map((m) => (
      [...m[1].matchAll(/<([0-9a-fA-F]*)>/g)].map((h) => Buffer.from(h[1], 'hex').toString('latin1')).join('')
    ));
    resolve(lines.join('\n'));
  });
  renderInvoicePdf(
    { invoiceNumber: 'INV-T1', lineItems: [{ description: 'Card commission', amount: 100 }], billTo: { name: 'ADCB' }, createdAt: new Date() },
    res,
    { bank: {}, ...settings },
  );
});

const hasWord = (text, word) => text.includes(word);

test('PDF: cleared VAT note is not printed; typed note is printed', async () => {
  const cleared = await pdfText({ vatNote: '', notesLines: ['Pay in 30 days'] });
  const typed = await pdfText({ vatNote: 'Registration complete', notesLines: ['Pay in 30 days'] });
  const unset = await pdfText({ notesLines: ['Pay in 30 days'] });
  assert.equal(hasWord(unset, 'established'), true, 'sanity: default sentence is findable in PDF text');
  assert.equal(hasWord(cleared, 'established'), false);
  assert.equal(hasWord(typed, 'established'), false);
  assert.equal(hasWord(typed, 'Registration'), true);
});
