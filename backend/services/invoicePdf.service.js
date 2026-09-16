const PDFDocument = require('pdfkit');

const MARGIN = 50;
const COL_DESC_X = 50;
const COL_DESC_W = 350;
const COL_AMT_X = 400;
const COL_AMT_W = 145;

function drawTableHeader(doc, y) {
  doc.fontSize(10).fillColor('#0f172a');
  doc.text('Description', COL_DESC_X, y, { width: COL_DESC_W });
  doc.text('Amount (AED)', COL_AMT_X, y, { width: COL_AMT_W, align: 'right' });
  doc.moveTo(COL_DESC_X, y + 18).lineTo(COL_AMT_X + COL_AMT_W, y + 18).strokeColor('#e2e8f0').stroke();
  return y + 26;
}

// Streams a formatted invoice PDF straight to `res` — nothing written to disk.
// Line items are paginated: any number of them (tested up to 500+) renders
// correctly across as many pages as needed instead of overflowing/overlapping.
function renderInvoicePdf(invoice, res) {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);

  const pageBottom = () => doc.page.height - doc.page.margins.bottom;

  doc.fontSize(20).fillColor('#0f172a').text('INVOICE', { align: 'right' });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#64748b').text(invoice.invoiceNumber, { align: 'right' });
  doc.moveDown(1.5);

  doc.fontSize(14).fillColor('#0f172a').text('MySilah', { continued: false });
  doc.fontSize(10).fillColor('#64748b').text('Bank & Loan Referral Services');
  doc.moveDown(1);

  const agencyName = invoice.agency?.name || invoice.agency?.email || '—';
  doc.fontSize(10).fillColor('#0f172a').text('Billed To:', { underline: true });
  doc.fontSize(11).text(agencyName);
  if (invoice.agency?.email) doc.fontSize(9).fillColor('#64748b').text(invoice.agency.email);
  doc.moveDown(0.5);

  doc.fontSize(9).fillColor('#64748b').text(`Issued: ${new Date(invoice.issuedAt).toLocaleDateString()}`);
  doc.text(`Status: ${invoice.status.toUpperCase()}`);
  if (invoice.lead?.leadNumber) doc.text(`Reference Lead: ${invoice.lead.leadNumber}`);
  doc.moveDown(1);

  // Line items table — paginated
  let y = drawTableHeader(doc, doc.y);

  const items = invoice.lineItems || [];
  items.forEach((item) => {
    const description = item.description || '';
    const amountText = Number(item.amount || 0).toLocaleString();
    const descHeight = doc.heightOfString(description, { width: COL_DESC_W });
    const rowHeight = Math.max(descHeight, 14) + 10;

    if (y + rowHeight > pageBottom()) {
      doc.addPage();
      y = drawTableHeader(doc, MARGIN);
    }

    doc.fontSize(10).fillColor('#0f172a').text(description, COL_DESC_X, y, { width: COL_DESC_W });
    doc.text(amountText, COL_AMT_X, y, { width: COL_AMT_W, align: 'right' });
    y += rowHeight;
  });

  // Total row — also page-break aware
  if (y + 40 > pageBottom()) {
    doc.addPage();
    y = MARGIN;
  }
  doc.moveTo(COL_DESC_X, y + 4).lineTo(COL_AMT_X + COL_AMT_W, y + 4).strokeColor('#e2e8f0').stroke();
  y += 14;
  doc.fontSize(12).fillColor('#0f172a').text('Total', 350, y, { width: 100 });
  doc.text(`AED ${Number(invoice.amount || 0).toLocaleString()}`, COL_AMT_X, y, { width: COL_AMT_W, align: 'right' });
  y += 30;

  if (invoice.notes) {
    if (y + 40 > pageBottom()) {
      doc.addPage();
      y = MARGIN;
    }
    doc.fontSize(9).fillColor('#64748b').text('Notes:', COL_DESC_X, y, { underline: true });
    doc.text(invoice.notes, COL_DESC_X, doc.y, { width: 495 });
  }

  doc.end();
}

module.exports = { renderInvoicePdf };
