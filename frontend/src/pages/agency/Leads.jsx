import { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Typography, Button, Input, Select, Row, Col, Space, message, Popconfirm } from 'antd';
import { SearchOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import api from '../../api/client';

const STATUSES = [
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

// Reject is allowed from any non-terminal-positive status.
const REJECTABLE_FROM = ['submitted', 'under_review', 'assigned', 'approved'];

function AgencyLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState();
  const [productFilter, setProductFilter] = useState();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads/agency');
      setLeads(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/leads/${id}/status`, { status });
      message.success(`Marked as ${STATUSES.find((s) => s.value === status)?.label}`);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
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
    { title: 'Filed by', render: (_, row) => row.agent ? (row.agent.name || row.agent.email) : '—' },
    { title: 'Product', dataIndex: 'productType', render: (v) => PRODUCTS.find((p) => p.value === v)?.label },
    { title: 'Bank', dataIndex: ['bank', 'name'] },
    {
      title: 'Stage',
      dataIndex: 'status',
      render: (s) => {
        const meta = STATUSES.find((x) => x.value === s);
        return <Tag color={meta?.color}>{meta?.label || s}</Tag>;
      },
    },
    {
      title: 'Actions',
      width: 360,
      render: (_, row) => {
        const canReject = REJECTABLE_FROM.includes(row.status);
        return (
          <Space wrap>
            {row.status === 'submitted' && (
              <Button size="small" onClick={() => updateStatus(row._id, 'under_review')}>Start Review</Button>
            )}
            {row.status === 'under_review' && (
              <Button size="small" onClick={() => updateStatus(row._id, 'assigned')}>Mark Assigned</Button>
            )}
            {row.status === 'assigned' && (
              <Popconfirm title="Approve this lead?" onConfirm={() => updateStatus(row._id, 'approved')}>
                <Button size="small" type="primary" icon={<CheckOutlined />}>Approve</Button>
              </Popconfirm>
            )}
            {row.status === 'approved' && (
              <Button size="small" onClick={() => updateStatus(row._id, 'disbursed')}>Mark Disbursed</Button>
            )}
            {canReject && (
              <Popconfirm title="Reject this lead?" onConfirm={() => updateStatus(row._id, 'rejected')}>
                <Button size="small" danger icon={<CloseOutlined />}>Reject</Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Typography.Title level={3} style={{ margin: 0 }}>Lead Queue</Typography.Title>
          <Typography.Text type="secondary">
            Leads filed to your agency. Approve is only enabled once a lead reaches <i>Assigned</i>; reject is available throughout.
          </Typography.Text>
        </Col>
      </Row>

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
        <Typography.Text type="secondary">{filtered.length} leads</Typography.Text>
      </Space>

      <Table rowKey="_id" loading={loading} dataSource={filtered} columns={columns} />
    </>
  );
}

export default AgencyLeads;
