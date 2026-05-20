import { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Typography, Input, Select, DatePicker, Space, Button, Tabs, Tooltip } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

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
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState();
  const [productFilter, setProductFilter] = useState();
  const [dateRange, setDateRange] = useState(null);

  const [leadsTab, setLeadsTab] = useState('active');

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

  const activeCount = leads.filter(l => l.status !== 'disbursed' && l.status !== 'rejected').length;
  const rejectedCount = leads.filter(l => l.status === 'rejected').length;
  const archiveCount = leads.filter(l => l.status === 'disbursed').length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const [from, to] = dateRange || [];
    return leads.filter((l) => {
      if (leadsTab === 'archive' && l.status !== 'disbursed') return false;
      if (leadsTab === 'rejected' && l.status !== 'rejected') return false;
      if (leadsTab === 'active' && (l.status === 'disbursed' || l.status === 'rejected')) return false;
      if (q && !l.customerName.toLowerCase().includes(q) && !String(l._id).toLowerCase().includes(q)) return false;
      if (statusFilter && l.status !== statusFilter) return false;
      if (productFilter && l.productType !== productFilter) return false;
      if (from && dayjs(l.createdAt).isBefore(from.startOf('day'))) return false;
      if (to && dayjs(l.createdAt).isAfter(to.endOf('day'))) return false;
      return true;
    });
  }, [leads, search, statusFilter, productFilter, dateRange, leadsTab]);

  const renderProduct = (row) => {
    const name = row.productType === 'credit_card' ? row.cardProduct?.name : row.loanProduct?.name;
    const sub = row.productType === 'credit_card'
      ? (row.cardProduct?.cardType === 'premium' ? 'Premium' : 'Regular')
      : (row.loanProduct?.loanCategory === 'mortgage' ? 'Mortgage' : 'Personal');
    if (!name) return PRODUCTS.find((p) => p.value === row.productType)?.label || row.productType;
    return (
      <Tooltip title={name}>
        <div>
          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 11, color: '#888' }}>{sub}</div>
        </div>
      </Tooltip>
    );
  };

  const columns = [
    {
      title: 'Lead ID',
      dataIndex: 'leadNumber',
      width: 128,
      render: (v) => (
        <Typography.Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>{v || '—'}</Typography.Text>
      ),
    },
    {
      title: 'Client',
      width: 140,
      ellipsis: true,
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.customerName}</div>
          <div style={{ fontSize: 11, color: '#888' }}>{row.phone}</div>
        </div>
      ),
    },
    {
      title: 'Agent',
      width: 90,
      ellipsis: true,
      render: (_, row) => row.agent?.name || row.agent?.email || '—',
    },
    {
      title: 'Agency',
      width: 90,
      ellipsis: true,
      render: (_, row) => row.agency?.name || row.agency?.email || '—',
    },
    {
      title: 'Product',
      width: 170,
      ellipsis: true,
      render: (_, row) => renderProduct(row),
    },
    {
      title: 'Bank',
      width: 110,
      ellipsis: true,
      render: (_, row) => row.bank?.name || '—',
    },
    {
      title: 'Stage',
      width: 108,
      render: (_, row) => {
        const meta = STATUSES.find((x) => x.value === row.status);
        return <Tag color={meta?.color}>{meta?.label || row.status}</Tag>;
      },
    },
    {
      title: 'Emp. Status',
      width: 108,
      render: (_, row) => row.employeeStatus
        ? <Tag color={row.employeeStatus.color}>{row.employeeStatus.label}</Tag>
        : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Commission',
      width: 118,
      align: 'right',
      render: (_, row) => (
        <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
          {row.grossCommission > 0 && <div style={{ fontSize: 11, color: '#888' }}>Gross: {aed(row.grossCommission)}</div>}
          <span style={{ fontWeight: 600 }}>{aed(row.commission)}</span>
          {row.commissionStatus !== 'none' && (
            <Tag color={row.commissionStatus === 'paid' ? 'green' : row.commissionStatus === 'payable' ? 'cyan' : 'gold'} style={{ marginInlineEnd: 0 }}>
              {row.commissionStatus}
            </Tag>
          )}
        </Space>
      ),
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
          <DatePicker.RangePicker
            value={dateRange}
            onChange={setDateRange}
            allowClear
            style={{ width: 240 }}
          />
          {(search || statusFilter || productFilter || dateRange) && (
            <Button onClick={() => { setSearch(''); setStatusFilter(undefined); setProductFilter(undefined); setDateRange(null); }}>
              Clear Filters
            </Button>
          )}
        </Space>
        <Typography.Text type="secondary">{filtered.length} shown</Typography.Text>
      </Space>

      <Tabs
        activeKey={leadsTab}
        onChange={setLeadsTab}
        style={{ marginBottom: 8 }}
        items={[
          { key: 'active', label: `Active (${activeCount})` },
          { key: 'rejected', label: `Rejected (${rejectedCount})` },
          { key: 'archive', label: `Approved (${archiveCount})` },
        ]}
      />
      <Table size="small" rowKey="_id" loading={loading} dataSource={filtered} columns={columns} tableLayout="fixed" onRow={(row) => ({ onClick: () => navigate(`/admin/leads/${row._id}`), style: { cursor: 'pointer' } })} />
    </>
  );
}

export default AdminLeads;
