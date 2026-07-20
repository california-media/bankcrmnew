import * as XLSX from 'xlsx';

const HEADERS = [
  'Lead No', 'Reference No', 'Lead Status',
  'Customer Name', 'Phone', 'Agent Email', 'Product Type', 'Bank', 'Product Name',
  'Monthly Salary', 'Email', 'Nationality', 'City', 'Visa Type', 'Company Name',
  'Job Title', 'Experience (Yrs)', 'Loan Amount', 'Loan Type',
];

const EXAMPLE_ROW = {
  'Lead No': '',
  'Reference No': '',
  'Lead Status': '',
  'Customer Name': 'Mohammed Ahmed',
  Phone: '0501234567',
  'Agent Email': 'agent@gmail.com',
  'Product Type': 'credit_card',
  Bank: 'ADCB',
  'Product Name': 'Aafaq Titanium Credit Card',
  'Monthly Salary': 8000,
  Email: '',
  Nationality: '',
  City: '',
  'Visa Type': '',
  'Company Name': '',
  'Job Title': '',
  'Experience (Yrs)': '',
  'Loan Amount': '',
  'Loan Type': '',
};

export default function downloadLeadImportTemplate() {
  const worksheet = XLSX.utils.json_to_sheet([EXAMPLE_ROW], { header: HEADERS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads Import');
  XLSX.writeFile(workbook, 'leads-import-template.xlsx');
}
