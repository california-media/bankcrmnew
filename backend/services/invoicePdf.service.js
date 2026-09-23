const PDFDocument = require('pdfkit');
const { amountToWordsAed } = require('../utils/numberToWords');

// Mirrors frontend/src/components/InvoicePreview.jsx section-for-section —
// keep both in sync if the invoice layout changes.
const PAGE_MARGIN = 50;
const CONTENT_X = PAGE_MARGIN;
const CONTENT_W = 495;
const CONTENT_RIGHT = CONTENT_X + CONTENT_W;
const LEFT_W = 300;
const RIGHT_W = CONTENT_W - LEFT_W;
const RIGHT_X = CONTENT_X + LEFT_W;

const NAVY = '#1e3a5f';
const BORDER = '#d9dee6';
const TEXT_DARK = '#111827';
const TEXT_GRAY = '#4b5563';
const LIGHT_GRAY = '#f3f4f6';
const TOTAL_BG = '#e3e9f3';

// MySilah's own fixed letterhead details — same on every invoice, not stored
// per-record. Bank details / notes text are admin-editable (CompanySettings)
// and passed in as `companySettings`; these are the fallback if that hasn't
// been set up yet.
const COMPANY = {
  officeAddressLines: ['Meydan Grandstand, 6th Floor, Meydan Road, Nad Al Sheba, Dubai,', 'U.A.E.'],
  email: 'admin@mysilah.ae',
  trnStatus: 'Under Process',
};
const DEFAULT_BANK = {
  accountName: 'SILAH LLC FZ',
  bankName: 'FIRST ABUDHABI BANK',
  accountNo: '1001327172066000',
  iban: 'AE400351001327172066',
};
const DEFAULT_NOTES_LINES = [
  'Payment is due as per the agreed payment terms.',
  'Please include the invoice number in the payment reference.',
  'Late payment may be subject to applicable terms.',
  'For invoice queries, please contact us.',
];
const DEFAULT_VAT_NOTE = 'Since Silah is a newly established company, our VAT registration is currently under process.';

const COLS = [
  { key: 'sno', label: 'S.No', x: 50, w: 30, align: 'center' },
  { key: 'customer', label: 'Customer Name', x: 80, w: 105, align: 'left' },
  { key: 'description', label: 'Description', x: 185, w: 140, align: 'left' },
  { key: 'qty', label: 'Qty', x: 325, w: 30, align: 'center' },
  { key: 'unit', label: 'Unit Price\n(AED)', x: 355, w: 62, align: 'right' },
  { key: 'vat', label: 'VAT 5%\n(AED)', x: 417, w: 62, align: 'right' },
  { key: 'total', label: 'Total\n(AED)', x: 479, w: 66, align: 'right' },
];
const CELL_PAD = 5;

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).split('/').join('-') : '—';

function drawLogo(doc, y) {
  doc.font('Helvetica-Bold').fontSize(30)
    .fillColor(TEXT_DARK).text('My', CONTENT_X, y, { continued: true })
    .fillColor('#2563eb').text('Silah');
  doc.font('Helvetica').fontSize(8).fillColor('#94a3b8')
    .text('CONNECT.  EMPOWER.  GROW.', CONTENT_X, y + 32);
}

// `align: 'right'` combined with `continued: true` mis-renders in pdfkit
// (fragments overlap instead of concatenating) — so each mixed-weight line
// is right-aligned by hand: measure both fragments, then place them
// side-by-side ending at CONTENT_RIGHT.
function drawHeaderMeta(doc, invoice, y) {
  doc.font('Helvetica-Bold').fontSize(26).fillColor(NAVY).text('INVOICE', CONTENT_X, y, { width: CONTENT_W, align: 'right' });
  let metaY = y + 32;
  const metaLine = (label, value) => {
    doc.font('Helvetica-Bold').fontSize(9);
    const labelText = `${label} `;
    const labelW = doc.widthOfString(labelText);
    doc.font('Helvetica').fontSize(9);
    const valueW = doc.widthOfString(value);
    const startX = CONTENT_RIGHT - labelW - valueW;
    doc.font('Helvetica-Bold').fillColor(TEXT_DARK).text(labelText, startX, metaY, { lineBreak: false });
    doc.font('Helvetica').text(value, startX + labelW, metaY, { lineBreak: false });
    metaY += 13;
  };
  metaLine('Invoice No.:', invoice.invoiceNumber);
  metaLine('Invoice Date:', fmtDate(invoice.issuedAt));
  metaLine('Due:', `${invoice.dueDays ?? 15} days`);
  return metaY + 6;
}

function drawTwoColBox(doc, y, { bg, header, leftLines, rightLines, headerBg }) {
  const height = Math.max(
    (header ? 20 : 0) + leftLines.reduce((h, l) => h + (l.gap || 13), 8),
    (header ? 20 : 0) + rightLines.reduce((h, l) => h + (l.gap || 13), 8)
  );
  if (bg) doc.rect(CONTENT_X, y, CONTENT_W, height).fill(bg);
  doc.rect(CONTENT_X, y, CONTENT_W, height).strokeColor(BORDER).lineWidth(1).stroke();
  doc.moveTo(RIGHT_X, y).lineTo(RIGHT_X, y + height).strokeColor(BORDER).stroke();

  let cursorY = y + 8;
  if (header) {
    doc.rect(CONTENT_X, y, LEFT_W, 20).fill(headerBg || NAVY);
    doc.rect(RIGHT_X, y, RIGHT_W, 20).fill(headerBg || NAVY);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#fff')
      .text(header[0], CONTENT_X + CELL_PAD, y + 6, { width: LEFT_W - CELL_PAD * 2 })
      .text(header[1], RIGHT_X + CELL_PAD, y + 6, { width: RIGHT_W - CELL_PAD * 2 });
    cursorY = y + 28;
  }

  let leftY = cursorY;
  leftLines.forEach((line) => {
    doc.font(line.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(line.size || 9).fillColor(line.color || TEXT_DARK)
      .text(line.text, CONTENT_X + CELL_PAD, leftY, { width: LEFT_W - CELL_PAD * 2 });
    leftY += line.gap || 13;
  });

  let rightY = cursorY;
  rightLines.forEach((line) => {
    doc.font(line.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(line.size || 9).fillColor(line.color || TEXT_DARK)
      .text(line.text, RIGHT_X + CELL_PAD, rightY, { width: RIGHT_W - CELL_PAD * 2 });
    rightY += line.gap || 13;
  });

  return y + height;
}

function drawTableHeader(doc, y, vatLabel) {
  doc.rect(CONTENT_X, y, CONTENT_W, 24).fill(NAVY);
  COLS.forEach((col) => {
    const label = col.key === 'vat' && vatLabel ? vatLabel : col.label;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#fff')
      .text(label, col.x + CELL_PAD, y + 4, { width: col.w - CELL_PAD * 2, align: col.align, lineGap: 1 });
  });
  return y + 24;
}

function drawColumnDividers(doc, topY, bottomY) {
  doc.lineWidth(1).strokeColor(BORDER);
  COLS.forEach((col) => {
    doc.moveTo(col.x, topY).lineTo(col.x, bottomY).stroke();
  });
  doc.moveTo(CONTENT_RIGHT, topY).lineTo(CONTENT_RIGHT, bottomY).stroke();
  doc.rect(CONTENT_X, topY, CONTENT_W, bottomY - topY).strokeColor(BORDER).stroke();
}

// Streams a formatted invoice PDF straight to `res` — nothing written to disk.
// Line items are paginated: any number of them renders correctly across as
// many pages as needed instead of overflowing/overlapping.
function renderInvoicePdf(invoice, res, companySettings) {
  const bank = companySettings?.bank || DEFAULT_BANK;
  const notesLines = companySettings?.notesLines?.length ? companySettings.notesLines : DEFAULT_NOTES_LINES;
  const vatNote = companySettings?.vatNote || DEFAULT_VAT_NOTE;

  const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);

  const pageBottom = () => doc.page.height - doc.page.margins.bottom;
  const vatRate = invoice.vatRate ?? 5;
  const vatLabel = `VAT ${vatRate}%\n(AED)`;

  drawLogo(doc, 50);
  const afterMeta = drawHeaderMeta(doc, invoice, 50);
  let y = Math.max(afterMeta, 100);

  // Office Address / Contact Person
  const createdByName = invoice.createdBy?.name || 'MySilah Team';
  y = drawTwoColBox(doc, y, {
    bg: LIGHT_GRAY,
    header: null,
    leftLines: [
      { text: 'Office Address', bold: true, gap: 13 },
      { text: COMPANY.officeAddressLines[0], gap: 13 },
      { text: COMPANY.officeAddressLines[1], gap: 13 },
      { text: `Email: ${COMPANY.email}`, gap: 13 },
    ],
    rightLines: [
      { text: 'Contact Person', bold: true, gap: 13 },
      { text: createdByName, gap: 13 },
      ...(invoice.createdBy?.phone ? [{ text: `Phone: ${invoice.createdBy.phone}`, gap: 13 }] : []),
      { text: `TRN: ${COMPANY.trnStatus}`, gap: 13 },
    ],
  });
  y += 14;

  // Bill To / Invoice Details
  const agencyName = invoice.agency?.name || invoice.agency?.email || '—';
  const billTo = invoice.billTo || {};
  const billToLeft = [{ text: agencyName, bold: true, gap: 13 }];
  if (billTo.trn) billToLeft.push({ text: `TRN: ${billTo.trn}`, gap: 13 });
  if (billTo.address) billToLeft.push({ text: billTo.address, gap: 13 });
  billToLeft.push({ text: `Contact / Email: ${billTo.contact || invoice.agency?.email || '—'}`, gap: 13 });

  y = drawTwoColBox(doc, y, {
    header: ['BILL TO', 'INVOICE DETAILS'],
    leftLines: billToLeft,
    rightLines: [
      { text: `Invoice No.: ${invoice.invoiceNumber}`, gap: 13 },
      { text: `Invoice Date: ${fmtDate(invoice.issuedAt)}`, gap: 13 },
      { text: `Payment Terms: ${invoice.paymentTermsDays ?? 30} days`, gap: 13 },
    ],
  });
  y += 18;

  // Line items table
  let tableTop = y;
  y = drawTableHeader(doc, y, vatLabel);
  const items = invoice.lineItems || [];
  items.forEach((item, index) => {
    const description = item.description || '';
    const customerName = item.customerName || '—';
    const descHeight = doc.font('Helvetica').fontSize(9).heightOfString(description, { width: COLS[2].w - CELL_PAD * 2 });
    const custHeight = doc.heightOfString(customerName, { width: COLS[1].w - CELL_PAD * 2 });
    const rowHeight = Math.max(descHeight, custHeight, 12) + 12;

    if (y + rowHeight > pageBottom() - 20) {
      drawColumnDividers(doc, tableTop, y);
      doc.addPage();
      tableTop = PAGE_MARGIN;
      y = drawTableHeader(doc, PAGE_MARGIN, vatLabel);
    }

    const cellY = y + 6;
    doc.font('Helvetica').fontSize(9).fillColor(TEXT_DARK);
    doc.text(String(index + 1), COLS[0].x + CELL_PAD, cellY, { width: COLS[0].w - CELL_PAD * 2, align: 'center' });
    doc.text(customerName, COLS[1].x + CELL_PAD, cellY, { width: COLS[1].w - CELL_PAD * 2 });
    doc.text(description, COLS[2].x + CELL_PAD, cellY, { width: COLS[2].w - CELL_PAD * 2 });
    doc.text(String(item.qty ?? 1), COLS[3].x + CELL_PAD, cellY, { width: COLS[3].w - CELL_PAD * 2, align: 'center' });
    doc.text(fmt(item.unitPrice), COLS[4].x + CELL_PAD, cellY, { width: COLS[4].w - CELL_PAD * 2, align: 'right' });
    doc.text(fmt(item.vatAmount), COLS[5].x + CELL_PAD, cellY, { width: COLS[5].w - CELL_PAD * 2, align: 'right' });
    doc.text(fmt(item.amount), COLS[6].x + CELL_PAD, cellY, { width: COLS[6].w - CELL_PAD * 2, align: 'right' });

    doc.moveTo(CONTENT_X, y + rowHeight).lineTo(CONTENT_RIGHT, y + rowHeight).strokeColor(BORDER).lineWidth(0.5).stroke();
    y += rowHeight;
  });
  drawColumnDividers(doc, tableTop, y);
  y += 18;

  // Amount in words + totals
  if (y + 90 > pageBottom()) { doc.addPage(); y = PAGE_MARGIN; }
  const subtotal = items.reduce((s, li) => s + Number(li.qty ?? 1) * Number(li.unitPrice || 0), 0);
  const vatTotal = items.reduce((s, li) => s + Number(li.vatAmount || 0), 0);
  const total = invoice.amount || 0;
  const wordsBoxTop = y;
  const rowH = 24;
  doc.rect(CONTENT_X, y, CONTENT_W, rowH * 2).strokeColor(BORDER).stroke();
  doc.moveTo(RIGHT_X, y).lineTo(RIGHT_X, y + rowH * 2).strokeColor(BORDER).stroke();
  doc.moveTo(CONTENT_X, y + rowH).lineTo(CONTENT_RIGHT, y + rowH).strokeColor(BORDER).stroke();
  const labelValW = RIGHT_W * 0.55;
  doc.moveTo(RIGHT_X + labelValW, y).lineTo(RIGHT_X + labelValW, y + rowH * 2).strokeColor(BORDER).stroke();

  doc.rect(CONTENT_X, y, LEFT_W, rowH).fill(LIGHT_GRAY);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT_DARK).text('AMOUNT IN WORDS', CONTENT_X + CELL_PAD, y + 8, { width: LEFT_W - CELL_PAD * 2 });
  doc.font('Helvetica').fontSize(8.5).fillColor(TEXT_DARK)
    .text(amountToWordsAed(total), CONTENT_X + CELL_PAD, y + rowH + 8, { width: LEFT_W - CELL_PAD * 2 });

  doc.font('Helvetica').fontSize(9).fillColor(TEXT_DARK)
    .text('Subtotal (AED)', RIGHT_X + CELL_PAD, y + 8, { width: labelValW - CELL_PAD * 2 })
    .text(`VAT ${vatRate}% (AED)`, RIGHT_X + CELL_PAD, y + rowH + 8, { width: labelValW - CELL_PAD * 2 });
  doc.text(fmt(subtotal), RIGHT_X + labelValW + CELL_PAD, y + 8, { width: RIGHT_W - labelValW - CELL_PAD * 2, align: 'right' });
  doc.text(fmt(vatTotal), RIGHT_X + labelValW + CELL_PAD, y + rowH + 8, { width: RIGHT_W - labelValW - CELL_PAD * 2, align: 'right' });

  y += rowH * 2;
  doc.rect(RIGHT_X, y, RIGHT_W, rowH).fill(TOTAL_BG);
  doc.rect(CONTENT_X, y, LEFT_W, rowH).strokeColor(BORDER).stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY)
    .text('TOTAL (AED)', RIGHT_X + CELL_PAD, y + 7, { width: labelValW - CELL_PAD * 2 });
  doc.text(fmt(total), RIGHT_X + labelValW + CELL_PAD, y + 7, { width: RIGHT_W - labelValW - CELL_PAD * 2, align: 'right' });
  doc.rect(CONTENT_X, wordsBoxTop, CONTENT_W, rowH * 3).strokeColor(BORDER).stroke();
  y += rowH + 18;

  // Notes & Payment Terms / Bank Details
  if (y + 130 > pageBottom()) { doc.addPage(); y = PAGE_MARGIN; }
  const notesTop = y;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT_DARK).text('NOTES & PAYMENT TERMS', CONTENT_X + CELL_PAD, y + 8, { width: LEFT_W - CELL_PAD * 2 });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT_DARK).text('BANK DETAILS', RIGHT_X + CELL_PAD, y + 8, { width: RIGHT_W - CELL_PAD * 2 });

  let noteY = y + 22;
  doc.font('Helvetica').fontSize(8.5).fillColor(TEXT_GRAY);
  notesLines.forEach((line) => {
    doc.text(`• ${line}`, CONTENT_X + CELL_PAD, noteY, { width: LEFT_W - CELL_PAD * 2 });
    noteY += doc.heightOfString(`• ${line}`, { width: LEFT_W - CELL_PAD * 2 }) + 3;
  });
  noteY += 6;
  doc.text(vatNote, CONTENT_X + CELL_PAD, noteY, { width: LEFT_W - CELL_PAD * 2 });
  noteY += doc.heightOfString(vatNote, { width: LEFT_W - CELL_PAD * 2 });

  let bankY = y + 22;
  const bankLine = (label, value) => {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(TEXT_DARK)
      .text(`${label} `, RIGHT_X + CELL_PAD, bankY, { width: RIGHT_W - CELL_PAD * 2, continued: true })
      .font('Helvetica').text(value);
    bankY += 13;
  };
  bankLine('Account Name:', bank.accountName);
  bankLine('Bank Name:', bank.bankName);
  bankLine('Account No.:', bank.accountNo);
  bankLine('IBAN:', bank.iban);

  const boxBottom = Math.max(noteY, bankY) + 10;
  doc.rect(CONTENT_X, notesTop, CONTENT_W, boxBottom - notesTop).strokeColor(BORDER).stroke();
  doc.moveTo(RIGHT_X, notesTop).lineTo(RIGHT_X, boxBottom).strokeColor(BORDER).stroke();
  y = boxBottom + 24;

  // Prepared By / Signature
  if (y + 60 > pageBottom()) { doc.addPage(); y = PAGE_MARGIN; }
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT_DARK)
    .text('Prepared By: ', CONTENT_X, y, { continued: true })
    .font('Helvetica').text(createdByName);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TEXT_DARK)
    .text('Authorized Signature / Stamp:', RIGHT_X, y);
  y += 34;
  doc.moveTo(CONTENT_X, y).lineTo(CONTENT_X + 190, y).strokeColor(TEXT_DARK).lineWidth(0.75).stroke();
  doc.moveTo(RIGHT_X, y).lineTo(RIGHT_X + 190, y).strokeColor(TEXT_DARK).stroke();
  y += 20;

  doc.moveTo(CONTENT_X, y).lineTo(CONTENT_RIGHT, y).strokeColor(NAVY).lineWidth(1.5).stroke();
  y += 12;
  doc.font('Helvetica').fontSize(9).fillColor(NAVY).text('Thank you for your business.', CONTENT_X, y, { width: CONTENT_W, align: 'center' });

  doc.end();
}

module.exports = { renderInvoicePdf };
