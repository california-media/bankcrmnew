import { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Typography, Button, Input, Select, Row, Col, Space, Tabs, Card, Empty } from 'antd';
import { PlusOutlined, SearchOutlined, TableOutlined, AppstoreOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
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

function MyLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState();
  const [productFilter, setProductFilter] = useState();
  const [leadsTab, setLeadsTab] = useState('active');
  const [viewMode, setViewMode] = useState('table');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads/mine');
      setLeads(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (leadsTab === 'archive' && l.status !== 'disbursed') return false;
      if (leadsTab === 'rejected' && l.status !== 'rejected') return false;
      if (leadsTab === 'active' && (l.status === 'disbursed' || l.status === 'rejected')) return false;
      if (q && !l.customerName.toLowerCase().includes(q) && !(l.leadNumber || '').toLowerCase().includes(q)) return false;
      if (statusFilter && l.status !== statusFilter) return false;
      if (productFilter && l.productType !== productFilter) return false;
      return true;
    });
  }, [leads, search, statusFilter, productFilter, leadsTab]);

  const activeCount = leads.filter(l => l.status !== 'disbursed' && l.status !== 'rejected').length;
  const rejectedCount = leads.filter(l => l.status === 'rejected').length;
  const archiveCount = leads.filter(l => l.status === 'disbursed').length;

  const renderProduct = (row) => {
    if (row.productType === 'credit_card' && row.cardProduct) return row.cardProduct.name || 'Credit Card';
    if (row.productType === 'loan' && row.loanProduct) return row.loanProduct.name || 'Loan';
    return PRODUCTS.find((p) => p.value === row.productType)?.label || row.productType;
  };

  const columns = [
    {
      title: 'Lead ID',
      dataIndex: 'leadNumber',
      render: (leadNumber) => (
        <Typography.Text type="secondary" style={{ fontFamily: 'monospace', width: 130, whiteSpace: 'nowrap' }}>{leadNumber || '—'}</Typography.Text>
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
      title: 'Emp. Status',
      dataIndex: 'employeeStatus',
      render: (s) => s
        ? <Tag color={s.color}>{s.label}</Tag>
        : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Expected Payout',
      align: 'right',
      render: (_, row) => {
        if (row.commissionStatus === 'paid') {
          return (
            <div>
              <div style={{ fontWeight: 700, color: '#16a34a' }}>{aed(row.commission)}</div>
              <div style={{ fontSize: 11, color: '#16a34a' }}>Received</div>
            </div>
          );
        }
        return <span style={{ fontWeight: 600 }}>{aed(row.commission)}</span>;
      },
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
            {leads.length} total · Track every case from submission to commission payout.
          </Typography.Text>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<TableOutlined />}
              type={viewMode === 'table' ? 'primary' : 'default'}
              onClick={() => setViewMode('table')}
            >Table</Button>
            <Button
              icon={<AppstoreOutlined />}
              type={viewMode === 'card' ? 'primary' : 'default'}
              onClick={() => setViewMode('card')}
            >Cards</Button>
            <Link to="/agent/leads/new">
              <Button type="primary" icon={<PlusOutlined />}>New Lead</Button>
            </Link>
          </Space>
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

      {viewMode === 'table' ? (
        <Table
          size="small"
          rowKey="_id"
          loading={loading}
          dataSource={filtered}
          columns={columns}
          scroll={{ x: 'max-content' }}
          onRow={(row) => ({ onClick: () => navigate(`/agent/leads/${row._id}`), style: { cursor: 'pointer' } })}
        />
      ) : (
        <Row gutter={[14, 14]}>
          {filtered.map((row) => {
            const statusMeta = STATUSES.find((x) => x.value === row.status);
            return (
              <Col key={row._id} xs={24} sm={12} lg={8} xl={6}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => navigate(`/agent/leads/${row._id}`)}
                  style={{ borderRadius: 12, border: '1px solid #e2e8f0', cursor: 'pointer', height: '100%' }}
                  styles={{ body: { padding: '14px 16px' } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Typography.Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                      {row.leadNumber || '—'}
                    </Typography.Text>
                    <Tag color={statusMeta?.color} style={{ margin: 0 }}>{statusMeta?.label || row.status}</Tag>
                  </div>

                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', lineHeight: 1.3, marginBottom: 2 }}>
                    {row.customerName}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>{row.phone}</div>

                  <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{renderProduct(row)}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, marginBottom: 10 }}>{row.bank?.name || '—'}</div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 4 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      {new Date(row.createdAt).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}
                    </Typography.Text>
                    <div style={{ textAlign: 'right' }}>
                      {row.commissionStatus === 'paid' ? (
                        <>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#16a34a' }}>{aed(row.commission)}</div>
                          <div style={{ fontSize: 10, color: '#16a34a' }}>Received</div>
                        </>
                      ) : (
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{aed(row.commission)}</span>
                      )}
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
          {filtered.length === 0 && (
            <Col span={24}><Empty description="No leads found" /></Col>
          )}
        </Row>
      )}
    </>
  );
}

export default MyLeads;
