import { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Typography, Input, Tabs } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

const STATUSES = [
  { value: 'submitted', label: 'Submitted', color: 'blue' },
  { value: 'under_review', label: 'Under Review', color: 'gold' },
  { value: 'assigned', label: 'Assigned', color: 'cyan' },
  { value: 'approved', label: 'Approved', color: 'green' },
  { value: 'rejected', label: 'Rejected', color: 'red' },
  { value: 'disbursed', label: 'Disbursed', color: 'purple' },
];

const PRODUCT_LABELS = { credit_card: 'Credit Card', loan: 'Loan' };

function AssignedLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [leadsTab, setLeadsTab] = useState('active');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads/assigned');
      setLeads(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const activeCount = leads.filter(l => l.status !== 'disbursed').length;
  const archiveCount = leads.filter(l => l.status === 'disbursed').length;

  const filtered = useMemo(() => {
    let result = leads;
    if (leadsTab === 'archive') {
      result = result.filter(l => l.status === 'disbursed');
    } else {
      result = result.filter(l => l.status !== 'disbursed');
    }
    const q = search.trim().toLowerCase();
    if (!q) return result;
    return result.filter(
      (l) =>
        l.customerName?.toLowerCase().includes(q) ||
        (l.leadNumber || '').toLowerCase().includes(q)
    );
  }, [leads, search, leadsTab]);

  const columns = [
    {
      title: 'Lead ID',
      dataIndex: 'leadNumber',
      render: (v) => (
        <Typography.Text type="secondary" style={{ fontFamily: 'monospace', width: 130, whiteSpace: 'nowrap' }}>
          {v || '—'}
        </Typography.Text>
      ),
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
    {
      title: 'Product',
      dataIndex: 'productType',
      render: (v) => (
        <Tag>{PRODUCT_LABELS[v] || v}</Tag>
      ),
    },
    {
      title: 'Bank',
      dataIndex: ['bank', 'name'],
    },
    {
      title: 'Stage',
      dataIndex: 'status',
      render: (s) => {
        const meta = STATUSES.find((x) => x.value === s);
        return <Tag color={meta?.color}>{meta?.label || s}</Tag>;
      },
    },
    {
      title: 'Status',
      render: (_, row) => row.employeeStatus
        ? <Tag color={row.employeeStatus.color}>{row.employeeStatus.label}</Tag>
        : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Engagement',
      dataIndex: 'engagementStatus',
      render: (v) =>
        v ? <Tag>{v}</Tag> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Submitted',
      dataIndex: 'createdAt',
      render: (v) => v ? new Date(v).toLocaleDateString() : '—',
    },
  ];

  return (
    <>
      <Typography.Title level={3} style={{ margin: '0 0 8px' }}>My Leads</Typography.Title>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Leads assigned to you.
      </Typography.Text>

      <Input
        allowClear
        placeholder="Search client or lead ID..."
        prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: 280, marginBottom: 16 }}
      />

      <Tabs
        activeKey={leadsTab}
        onChange={setLeadsTab}
        style={{ marginBottom: 8 }}
        items={[
          { key: 'active', label: `Active (${activeCount})` },
          { key: 'archive', label: `Archive (${archiveCount})` },
        ]}
      />

      <Table
        size="small"
        rowKey="_id"
        loading={loading}
        dataSource={filtered}
        columns={columns}
        scroll={{ x: 'max-content' }}
        onRow={(row) => ({
          onClick: () => navigate(`/employee/leads/${row._id}`),
          style: { cursor: 'pointer' },
        })}
      />
    </>
  );
}

export default AssignedLeads;
