import { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Typography, Input, Select, Row, Col, Space, Button, Popconfirm, message } from 'antd';
import { SearchOutlined, DollarOutlined, SendOutlined } from '@ant-design/icons';
import api from '../../api/client';
import SendToAgencyModal from '../../components/SendToAgencyModal';

const STATUSES = [
  { value: 'draft', label: 'Draft', color: 'default' },
  { value: 'submitted', label: 'Submitted', color: 'blue' },
  { value: 'under_review', label: 'Under Review', color: 'gold' },
  { value: 'assigned', label: 'Assigned', color: 'cyan' },
  { value: 'approved', label: 'Approved', color: 'green' },
  { value: 'rejected', label: 'Rejected', color: 'red' },
  { value: 'disbursed', label: 'Disbursed', color: 'purple' },
];

const PRODUCTS = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'loan', label: 'Loan' },
];

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

function AdminLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState();
  const [productFilter, setProductFilter] = useState();

  const [sendOpen, setSendOpen] = useState(false);
  const [sendingLead, setSendingLead] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads');
      setLeads(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markPaid = async (id) => {
    try {
      await api.post(`/leads/${id}/mark-paid`);
      message.success('Commission marked paid');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (q && !l.customerName.toLowerCase().includes(q) && !String(l._id).toLowerCase().includes(q)) return false;
      if (statusFilter && l.status !== statusFilter) return false;
      if (productFilter && l.productType !== productFilter) return false;
      return true;
    });
  }, [leads, search, statusFilter, productFilter]);

  const columns = [
    {
      title: 'Lead ID',
      dataIndex: '_id',
      render: (id) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>LD-{String(id).slice(-6)}</Typography.Text>,
    },
    {
      title: 'Client',
      dataIndex: 'customerName',
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{row.phone}</div>
        </div>
      ),
    },
    { title: 'Agent', render: (_, row) => row.agent?.name || row.agent?.email || '—' },
    { title: 'Agency', render: (_, row) => row.agency?.name || row.agency?.email || <Typography.Text type="secondary">—</Typography.Text> },
    { title: 'Product', dataIndex: 'productType', render: (v) => PRODUCTS.find((p) => p.value === v)?.label },
    { title: 'Bank', render: (_, row) => row.bank?.name || <Typography.Text type="secondary">—</Typography.Text> },
    {
      title: 'Stage',
      dataIndex: 'status',
      render: (s) => {
        const meta = STATUSES.find((x) => x.value === s);
        return <Tag color={meta?.color}>{meta?.label || s}</Tag>;
      },
    },
    {
      title: 'Commission',
      dataIndex: 'commission',
      align: 'right',
      render: (v, row) => (
        <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
          <span style={{ fontWeight: 600 }}>{aed(v)}</span>
          {row.commissionStatus !== 'none' && (
            <Tag color={
              row.commissionStatus === 'paid' ? 'green' :
              row.commissionStatus === 'payable' ? 'cyan' : 'gold'
            } style={{ marginInlineEnd: 0 }}>
              {row.commissionStatus}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Actions',
      width: 220,
      render: (_, row) => {
        if (row.status === 'draft') {
          return (
            <Button size="small" type="primary" icon={<SendOutlined />} onClick={() => { setSendingLead(row); setSendOpen(true); }}>
              Send to Agency
            </Button>
          );
        }
        if (row.commissionStatus === 'payable') {
          return (
            <Popconfirm title="Mark this commission as paid?" onConfirm={() => markPaid(row._id)}>
              <Button size="small" icon={<DollarOutlined />}>Mark Paid</Button>
            </Popconfirm>
          );
        }
        return null;
      },
    },
  ];

  return (
    <>
      <Typography.Title level={3} style={{ margin: 0 }}>All Leads</Typography.Title>
      <Typography.Text type="secondary">{leads.length} total leads across the system.</Typography.Text>

      <Space wrap style={{ margin: '24px 0 16px', width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Input
            allowClear
            placeholder="Search client or lead ID..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <Select
            allowClear
            placeholder="All Stages"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            style={{ width: 180 }}
          />
          <Select
            allowClear
            placeholder="All Products"
            value={productFilter}
            onChange={setProductFilter}
            options={PRODUCTS}
            style={{ width: 180 }}
          />
        </Space>
        <Typography.Text type="secondary">{filtered.length} shown</Typography.Text>
      </Space>

      <Table rowKey="_id" loading={loading} dataSource={filtered} columns={columns} />

      <SendToAgencyModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        lead={sendingLead}
        onSent={load}
      />
    </>
  );
}

export default AdminLeads;
