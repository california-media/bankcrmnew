import { useEffect, useMemo, useState } from 'react';
import {
  Table, Tag, Typography, Button, Input, Tabs, Space, message, Popconfirm, Row, Col, Card,
} from 'antd';
import {
  SearchOutlined, DollarOutlined, CheckCircleOutlined, RiseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const COMM_COLORS = { payable: 'cyan', pending: 'gold', paid: 'green', none: 'default' };
const COMM_LABELS = { payable: 'Payout Ready for Agent', pending: 'Pending', paid: 'Paid', none: '—' };

export default function Payouts() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('payable');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads');
      setLeads(data.filter((l) => l.commissionStatus !== 'none'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const bulkPay = async (ids) => {
    setPaying(true);
    try {
      const body = ids ? { leadIds: ids } : {};
      const { data } = await api.post('/leads/bulk-mark-paid', body);
      message.success(`${data.count} payout(s) sent`);
      setSelectedRowKeys([]);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    } finally {
      setPaying(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (tab === 'payable' && l.commissionStatus !== 'payable') return false;
      if (tab === 'paid' && l.commissionStatus !== 'paid') return false;
      if (q && !l.customerName.toLowerCase().includes(q) && !(l.leadNumber || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [leads, search, tab]);

  const payableLeads = useMemo(() => leads.filter((l) => l.commissionStatus === 'payable'), [leads]);

  const stats = useMemo(() => ({
    payable: payableLeads.length,
    paid:    leads.filter((l) => l.commissionStatus === 'paid').length,
    totalPayable: payableLeads.reduce((s, l) => s + (l.commission || 0), 0),
    totalPaid: leads.filter((l) => l.commissionStatus === 'paid').reduce((s, l) => s + (l.commission || 0), 0),
  }), [leads, payableLeads]);

  const selectedPayable = useMemo(
    () => selectedRowKeys.filter((id) => payableLeads.some((l) => l._id === id)),
    [selectedRowKeys, payableLeads],
  );

  const columns = [
    {
      title: 'Lead ID',
      dataIndex: 'leadNumber',
      render: (v) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace', width: 130, whiteSpace: 'nowrap' }}>{v || '—'}</Typography.Text>,
    },
    {
      title: 'Client',
      dataIndex: 'customerName',
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{row.phone}</div>
        </div>
      ),
    },
    {
      title: 'Agent',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.agent?.name || row.agent?.email || '—'}</div>
          {row.agent?.name && <div style={{ fontSize: 12, color: '#94a3b8' }}>{row.agent.email}</div>}
        </div>
      ),
    },
    { title: 'Agency', render: (_, row) => row.agency?.name || row.agency?.email || '—' },
    { title: 'Bank', render: (_, row) => row.bank?.name || '—' },
    {
      title: 'Commission',
      align: 'right',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{aed(row.commission)}</div>
          {row.grossCommission > 0 && (
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Gross: {aed(row.grossCommission)}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'commissionStatus',
      render: (s) => <Tag color={COMM_COLORS[s]}>{COMM_LABELS[s]}</Tag>,
    },
    {
      title: 'Paid On',
      dataIndex: 'commissionPaidAt',
      render: (d) => d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    },
  ];

  const tabItems = [
    {
      key: 'payable',
      label: <span><DollarOutlined style={{ color: '#0891b2', marginRight: 5 }} />Payout Ready for Agent ({stats.payable})</span>,
    },
    {
      key: 'paid',
      label: <span><CheckCircleOutlined style={{ color: '#16a34a', marginRight: 5 }} />Paid ({stats.paid})</span>,
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Typography.Title level={4} style={{ margin: 0, fontWeight: 500 }}>Payouts to Agents</Typography.Title>
          <Typography.Text type="secondary">Send commission payouts to agents in bulk.</Typography.Text>
        </Col>
        <Col>
          <Space>
            {selectedPayable.length > 0 && (
              <Popconfirm
                title={`Send payout for ${selectedPayable.length} selected lead(s)?`}
                onConfirm={() => bulkPay(selectedPayable)}
              >
                <Button type="primary" icon={<DollarOutlined />} loading={paying}>
                  Pay Selected ({selectedPayable.length})
                </Button>
              </Popconfirm>
            )}
            {stats.payable > 0 && (
              <Popconfirm
                title={`Send all ${stats.payable} ready payouts (${aed(stats.totalPayable)} total)?`}
                onConfirm={() => bulkPay(null)}
              >
                <Button icon={<DollarOutlined />} loading={paying}>
                  Pay All Ready ({stats.payable})
                </Button>
              </Popconfirm>
            )}
          </Space>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12}>
          <Card
            size="small"
            style={{ borderRadius: 12, borderLeft: '4px solid #06b6d4', background: '#ecfeff', border: '1px solid #06b6d422' }}
            styles={{ body: { padding: '18px 20px' } }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#0891b2', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <DollarOutlined />Payout Ready for Agent
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#0e7490', lineHeight: 1.2 }}>{aed(stats.totalPayable)}</div>
            <div style={{ fontSize: 12, color: '#0891b2', marginTop: 6, opacity: 0.8 }}>{stats.payable} lead{stats.payable !== 1 ? 's' : ''} ready to pay</div>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card
            size="small"
            style={{ borderRadius: 12, borderLeft: '4px solid #22c55e', background: '#f0fdf4', border: '1px solid #22c55e22' }}
            styles={{ body: { padding: '18px 20px' } }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#16a34a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircleOutlined />Total Paid Out to Agent
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#15803d', lineHeight: 1.2 }}>{aed(stats.totalPaid)}</div>
            <div style={{ fontSize: 12, color: '#16a34a', marginTop: 6, opacity: 0.8 }}>{stats.paid} payout{stats.paid !== 1 ? 's' : ''} completed</div>
          </Card>
        </Col>
      </Row>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '0 24px 24px' }}>
        <Tabs
          activeKey={tab}
          onChange={(k) => { setTab(k); setSelectedRowKeys([]); }}
          items={tabItems}
          style={{ marginBottom: 0 }}
        />
        <Space style={{ marginBottom: 16 }}>
          <Input
            allowClear
            placeholder="Search client or lead ID..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <Typography.Text type="secondary">{filtered.length} records</Typography.Text>
        </Space>
        <Table
          size="small"
          rowKey="_id"
          loading={loading}
          dataSource={filtered}
          columns={columns}
          rowSelection={
            tab === 'payable'
              ? { selectedRowKeys, onChange: setSelectedRowKeys, getCheckboxProps: (row) => ({ disabled: row.commissionStatus !== 'payable' }) }
              : undefined
          }
          onRow={(row) => ({ onClick: () => navigate(`/admin/leads/${row._id}`), style: { cursor: 'pointer' } })}
        />
      </div>
    </>
  );
}
