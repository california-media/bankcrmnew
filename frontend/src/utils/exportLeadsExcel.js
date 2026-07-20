import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

const fmtDate = (d) => (d ? dayjs(d).format('DD MMM YYYY') : '');

const productName = (lead) =>
  lead.productType === 'credit_card'
    ? lead.cardProduct?.name || ''
    : lead.productType === 'loan'
      ? lead.loanProduct?.name || ''
      : '';

export default function exportLeadsToExcel(leads, { includeAgency = false } = {}) {
  const rows = (leads || []).map((lead) => {
    const row = {
      'Lead No': lead.leadNumber || '',
      'Customer Name': lead.customerName || '',
      Phone: lead.phone || '',
      Bank: lead.bank?.name || '',
      Product: productName(lead),
      Status: lead.status || '',
      'Commission Status': lead.commissionStatus || '',
      Agent: lead.agent?.name || lead.agent?.email || '',
    };
    if (includeAgency) {
      row.Agency = lead.agency?.name || lead.agency?.email || '';
    }
    row.Created = fmtDate(lead.createdAt);
    row['Last Updated'] = fmtDate(lead.updatedAt);
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads MIS Report');

  const filename = `leads-mis-report-${dayjs().format('YYYY-MM-DD')}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
