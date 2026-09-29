import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Spin, Result } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import api from '../api/client';
import InvoicePreview from '../components/InvoicePreview';

// Standalone full-page invoice view — this is what "View" opens in a new tab.
// Deliberately outside AppLayout (no sidebar) so it reads like a document,
// matching the PDF it mirrors.
function InvoiceView() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/invoices/${id}`)
      .then((res) => setInvoice(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load invoice'))
      .finally(() => setLoading(false));
  }, [id]);

  const downloadPdf = async () => {
    const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoice.invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
        <Result status="error" title="Could not load invoice" subTitle={error || 'Invoice not found'} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '32px 16px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Button type="primary" icon={<DownloadOutlined />} onClick={downloadPdf}>Download PDF</Button>
        </div>
        <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 24px rgba(15,23,42,0.08)' }}>
          <InvoicePreview invoice={invoice} />
        </div>
      </div>
    </div>
  );
}

export default InvoiceView;
