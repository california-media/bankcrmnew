import { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Typography, Button, Input, Select, Row, Col, Space } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import api from '../../api/client';

const STATUSES = [
  { value: 'submitted', label: 'Submitted', color: 'default' },
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

function MyLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState();
  const [productFilter, setProductFilter] = useState();

  useEffect(() => {
    setLoading(true);
    api.get('/leads/mine').then((res) => setLeads(res.data)).finally(() => setLoading(false));
  }, []);

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
    {
      title: 'Product',
      dataIndex: 'productType',
      render: (v) => PRODUCTS.find((p) => p.value === v)?.label,
    },
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
      title: 'Commission',
      dataIndex: 'commission',
      align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>{aed(v)}</span>,
    },
    {
      title: 'Submitted',
      dataIndex: 'createdAt',
      render: (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }),
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Typography.Title level={3} style={{ margin: 0 }}>My Leads</Typography.Title>
          <Typography.Text type="secondary">
            {leads.length} total leads · Track every case from submission to commission payout.
          </Typography.Text>
        </Col>
        <Col>
          <Link to="/agent/leads/new">
            <Button type="primary" icon={<PlusOutlined />}>Submit New Lead</Button>
          </Link>
        </Col>
      </Row>

      <Space wrap style={{ margin: '24px 0 16px', width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Input
            allowClear
            placeholder="Search by client name or lead ID..."
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

export default MyLeads;
