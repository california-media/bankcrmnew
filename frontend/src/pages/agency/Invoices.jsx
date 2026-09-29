import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Table, Tag, Button, Typography, message, Space, Badge } from 'antd';
import { DownloadOutlined, EyeOutlined, MessageOutlined } from '@ant-design/icons';
import api from '../../api/client';
import InvoiceNotesModal from '../../components/InvoiceNotesModal';

const STATUS_COLORS = { unpaid: 'orange', paid: 'green', cancelled: 'default' };

function AgencyInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notesFor, setNotesFor] = useState(null);
  const { user } = useSelector((s) => s.auth);
  // Only the agency's owner login writes notes; Account Access staff can read them.
  const canWriteNotes = user?.role === 'agency';

  const onNotesUpdated = (id, comments) => {
    setInvoices((prev) => prev.map((inv) => (inv._id === id ? { ...inv, comments } : inv)));
    setNotesFor((prev) => (prev && prev._id === id ? { ...prev, comments } : prev));
  };

  useEffect(() => {
    setLoading(true);
    api.get('/invoices').then((res) => setInvoices(res.data)).finally(() => setLoading(false));
  }, []);

  const downloadPdf = async (row) => {
    try {
      const res = await api.get(`/invoices/${row._id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${row.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Download failed');
    }
  };

  const columns = [
    { title: 'Invoice #', dataIndex: 'invoiceNumber', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Lead', dataIndex: 'lead', render: (l) => l?.leadNumber || <Typography.Text type="secondary">Manual</Typography.Text> },
    { title: 'Amount', dataIndex: 'amount', render: (v) => `AED ${Number(v || 0).toLocaleString()}` },
    {
      title: 'Status', dataIndex: 'status',
      render: (v) => <Tag color={STATUS_COLORS[v] || 'default'}>{v.toUpperCase()}</Tag>,
    },
    {
      title: 'Issued', dataIndex: 'issuedAt',
      render: (v) => v ? new Date(v).toLocaleDateString() : '—',
    },
    {
      title: 'Actions',
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => window.open(`/invoices/${row._id}/view`, '_blank')}>View</Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadPdf(row)}>PDF</Button>
          <Badge count={row.comments?.length || 0} size="small" color="#7c3aed">
            <Button size="small" icon={<MessageOutlined />} onClick={() => setNotesFor(row)}>Notes</Button>
          </Badge>
        </Space>
      ),
    },
  ];

  return (
    <>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Invoices</h2>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflowX: 'auto' }}>
        <Table size="small" rowKey="_id" loading={loading} dataSource={invoices} columns={columns} scroll={{ x: 'max-content' }} locale={{ emptyText: 'No invoices yet' }} />
      </div>
      <InvoiceNotesModal invoice={notesFor} open={!!notesFor} onClose={() => setNotesFor(null)} canWrite={canWriteNotes} onUpdated={onNotesUpdated} />
    </>
  );
}

export default AgencyInvoices;
