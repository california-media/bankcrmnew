import { amountToWordsAed } from '../utils/numberToWords';

// On-screen mirror of backend/services/invoicePdf.service.js — same header,
// Supplier/Contact Person, Bill To/Invoice Details, line-items table,
// totals, Notes/Bank Details and signature blocks, so the "View" page and the
// downloaded PDF look identical.
const NAVY = '#1e3a5f';
const BORDER = '#d9dee6';
const LIGHT_GRAY = '#f3f4f6';
const TOTAL_BG = '#e3e9f3';
const TEXT_DARK = '#111827';
const TEXT_GRAY = '#4b5563';

// MySilah's own fixed letterhead details — same on every invoice, not stored
// per-record. Bank details / notes text / TRN are admin-editable
// (CompanySettings, embedded on the invoice response as `companySettings`);
// these are the fallback if that hasn't been set up yet.
const COMPANY = {
  name: 'Silah L.L.C-FZ',
  officeAddressLines: ['Meydan Grandstand, 6th Floor, Meydan Road, Nad Al Sheba.', 'PO Box 95195, Dubai, UAE.'],
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

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).split('/').join('-')
  : '—';

const boxStyle = { border: `1px solid ${BORDER}`, borderRadius: 2, overflow: 'hidden' };
const twoColStyle = { display: 'grid', gridTemplateColumns: '300fr 195fr' };
const headerBarStyle = { background: NAVY, color: '#fff', fontWeight: 700, fontSize: 11, padding: '5px 10px' };
const bodyPadStyle = { padding: '10px' };
const lineStyle = { fontSize: 11.5, color: TEXT_DARK, marginBottom: 4, lineHeight: 1.5 };

function InvoicePreview({ invoice }) {
  if (!invoice) return null;
  const agencyName = invoice.agency?.name || invoice.agency?.email || '—';
  const items = invoice.lineItems || [];
  const billTo = invoice.billTo || {};
  const createdByName = invoice.createdBy?.name || 'MySilah Team';
  const bank = invoice.companySettings?.bank || DEFAULT_BANK;
  const notesLines = invoice.companySettings?.notesLines?.length ? invoice.companySettings.notesLines : DEFAULT_NOTES_LINES;
  const vatNote = invoice.companySettings?.vatNote || DEFAULT_VAT_NOTE;
  const trn = invoice.companySettings?.trn || COMPANY.trnStatus;
  const contactName = invoice.companySettings?.contactName || createdByName;
  const contactPhone = invoice.companySettings?.contactPhone || invoice.createdBy?.phone;
  const contactEmail = invoice.companySettings?.contactEmail || COMPANY.email;
  const vatRate = invoice.vatRate ?? 5;
  const subtotal = items.reduce((s, li) => s + Number(li.qty ?? 1) * Number(li.unitPrice || 0), 0);
  const vatTotal = items.reduce((s, li) => s + Number(li.vatAmount || 0), 0);
  const total = invoice.amount || 0;

  const thStyle = { background: NAVY, color: '#fff', fontWeight: 700, fontSize: 10.5, padding: '8px 10px', textAlign: 'left' };
  const tdStyle = { padding: '9px 10px', fontSize: 11.5, color: TEXT_DARK, borderBottom: `1px solid ${BORDER}`, verticalAlign: 'top', overflowWrap: 'anywhere', wordBreak: 'break-word' };

  return (
    <div style={{ background: '#fff', padding: '32px 36px', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <img src="/mysilah.svg" alt="MySilah" style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: NAVY, letterSpacing: 1 }}>INVOICE</div>
          <div style={{ fontSize: 11, color: TEXT_DARK, marginTop: 6, lineHeight: 1.7 }}>
            <div><strong>Invoice No.:</strong> {invoice.invoiceNumber}</div>
            <div><strong>Invoice Date:</strong> {fmtDate(invoice.issuedAt)}</div>
            <div><strong>Due:</strong> {invoice.dueDays ?? 15} days</div>
          </div>
        </div>
      </div>

      {/* Supplier / Contact Person */}
      <div style={{ ...boxStyle, ...twoColStyle, background: LIGHT_GRAY, marginBottom: 14 }}>
        <div style={{ ...bodyPadStyle, borderRight: `1px solid ${BORDER}` }}>
          <div style={{ ...lineStyle, fontWeight: 700 }}>Supplier</div>
          <div style={lineStyle}>{COMPANY.name}</div>
          <div style={lineStyle}>{COMPANY.officeAddressLines[0]}</div>
          <div style={lineStyle}>{COMPANY.officeAddressLines[1]}</div>
          <div style={lineStyle}>TRN: {trn}</div>
        </div>
        <div style={bodyPadStyle}>
          <div style={{ ...lineStyle, fontWeight: 700 }}>Contact Person</div>
          <div style={lineStyle}>{contactName}</div>
          {contactPhone && <div style={lineStyle}>Phone: {contactPhone}</div>}
          <div style={lineStyle}>Email: {contactEmail}</div>
        </div>
      </div>

      {/* Bill To / Invoice Details */}
      <div style={{ ...boxStyle, marginBottom: 18 }}>
        <div style={twoColStyle}>
          <div style={{ ...headerBarStyle, borderRight: `1px solid rgba(255,255,255,0.2)` }}>BILL TO</div>
          <div style={headerBarStyle}>INVOICE DETAILS</div>
        </div>
        <div style={twoColStyle}>
          <div style={{ ...bodyPadStyle, borderRight: `1px solid ${BORDER}` }}>
            <div style={{ ...lineStyle, fontWeight: 700 }}>{agencyName}</div>
            {billTo.trn && <div style={lineStyle}>TRN: {billTo.trn}</div>}
            {billTo.address && <div style={lineStyle}>{billTo.address}</div>}
            <div style={lineStyle}>Contact / Email: {billTo.contact || invoice.agency?.email || '—'}</div>
          </div>
          <div style={bodyPadStyle}>
            <div style={lineStyle}><strong>Invoice No.:</strong> {invoice.invoiceNumber}</div>
            <div style={lineStyle}><strong>Invoice Date:</strong> {fmtDate(invoice.issuedAt)}</div>
            <div style={lineStyle}><strong>Payment Terms:</strong> {invoice.paymentTermsDays ?? 30} days</div>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div style={{ ...boxStyle, marginBottom: 18 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '6%', borderRight: '1px solid rgba(255,255,255,0.25)' }}>S.No</th>
              <th style={{ ...thStyle, width: '21%', borderRight: '1px solid rgba(255,255,255,0.25)' }}>Customer Name</th>
              <th style={{ ...thStyle, width: '28%', borderRight: '1px solid rgba(255,255,255,0.25)' }}>Description</th>
              <th style={{ ...thStyle, width: '6%', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.25)' }}>Qty</th>
              <th style={{ ...thStyle, width: '13%', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.25)' }}>Unit Price (AED)</th>
              <th style={{ ...thStyle, width: '13%', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.25)' }}>VAT {vatRate}% (AED)</th>
              <th style={{ ...thStyle, width: '13%', textAlign: 'right' }}>Total (AED)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td style={{ ...tdStyle, borderRight: `1px solid ${BORDER}` }}>{i + 1}</td>
                <td style={{ ...tdStyle, borderRight: `1px solid ${BORDER}` }}>
                  {item.customerName || '—'}
                  {item.leadNumber && <div style={{ fontSize: 10, color: TEXT_GRAY, marginTop: 2 }}>({item.leadNumber})</div>}
                </td>
                <td style={{ ...tdStyle, borderRight: `1px solid ${BORDER}` }}>{item.description}</td>
                <td style={{ ...tdStyle, textAlign: 'center', borderRight: `1px solid ${BORDER}` }}>{item.qty ?? 1}</td>
                <td style={{ ...tdStyle, textAlign: 'right', borderRight: `1px solid ${BORDER}` }}>{fmt(item.unitPrice)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', borderRight: `1px solid ${BORDER}` }}>{fmt(item.vatAmount)}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Amount in words + totals */}
      <div style={{ ...boxStyle, display: 'grid', gridTemplateColumns: '300fr 108fr 87fr', marginBottom: 18 }}>
        <div style={{ background: LIGHT_GRAY, padding: '8px 10px', borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, fontWeight: 700, fontSize: 11 }}>
          AMOUNT IN WORDS
        </div>
        <div style={{ padding: '8px 10px', borderRight: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, fontSize: 11 }}>Subtotal (AED)</div>
        <div style={{ padding: '8px 10px', borderBottom: `1px solid ${BORDER}`, fontSize: 11, textAlign: 'right' }}>{fmt(subtotal)}</div>

        <div style={{ padding: '8px 10px', borderRight: `1px solid ${BORDER}`, fontSize: 11, gridRow: 2 }}>{amountToWordsAed(total)}</div>
        <div style={{ padding: '8px 10px', borderRight: `1px solid ${BORDER}`, fontSize: 11, gridRow: 2 }}>VAT {vatRate}% (AED)</div>
        <div style={{ padding: '8px 10px', fontSize: 11, textAlign: 'right', gridRow: 2 }}>{fmt(vatTotal)}</div>

        <div style={{ gridColumn: '1', gridRow: 3 }} />
        <div style={{ background: TOTAL_BG, padding: '8px 10px', fontWeight: 700, fontSize: 12, color: NAVY, gridRow: 3 }}>TOTAL (AED)</div>
        <div style={{ background: TOTAL_BG, padding: '8px 10px', fontWeight: 700, fontSize: 12, color: NAVY, textAlign: 'right', gridRow: 3 }}>{fmt(total)}</div>
      </div>

      {/* Notes & Payment Terms / Bank Details */}
      <div style={{ ...boxStyle, ...twoColStyle, marginBottom: 24 }}>
        <div style={{ ...bodyPadStyle, borderRight: `1px solid ${BORDER}` }}>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6 }}>NOTES &amp; PAYMENT TERMS</div>
          {notesLines.map((line, i) => (
            <div key={i} style={{ fontSize: 10.5, color: TEXT_GRAY, marginBottom: 3 }}>• {line}</div>
          ))}
          <div style={{ fontSize: 10.5, color: TEXT_GRAY, marginTop: 8 }}>{vatNote}</div>
        </div>
        <div style={bodyPadStyle}>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6 }}>BANK DETAILS</div>
          <div style={{ fontSize: 10.5, marginBottom: 3 }}><strong>Account Name:</strong> {bank.accountName}</div>
          <div style={{ fontSize: 10.5, marginBottom: 3 }}><strong>Bank Name:</strong> {bank.bankName}</div>
          <div style={{ fontSize: 10.5, marginBottom: 3 }}><strong>Account No.:</strong> {bank.accountNo}</div>
          <div style={{ fontSize: 10.5 }}><strong>IBAN:</strong> {bank.iban}</div>
        </div>
      </div>

      {/* Prepared By / Signature */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30 }}>
        <div>
          <div style={{ fontSize: 11, marginBottom: 30 }}><strong>Prepared By:</strong> {createdByName}</div>
          <div style={{ width: 190, borderTop: `1px solid ${TEXT_DARK}` }} />
        </div>
        <div>
          <div style={{ fontSize: 11, marginBottom: 30 }}><strong>Authorized Signature / Stamp:</strong></div>
          <div style={{ width: 190, borderTop: `1px solid ${TEXT_DARK}` }} />
        </div>
      </div>

      <div style={{ borderTop: `2px solid ${NAVY}`, paddingTop: 12 }}>
        <div style={{ textAlign: 'center', fontSize: 11, color: NAVY }}>This is system generated invoice doesn’t required the company stamp and sign.</div>
      </div>

      {invoice.notes && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: TEXT_GRAY, textDecoration: 'underline', marginBottom: 4 }}>Additional Notes:</div>
          <div style={{ fontSize: 11, color: TEXT_GRAY }}>{invoice.notes}</div>
        </div>
      )}
    </div>
  );
}

export default InvoicePreview;
