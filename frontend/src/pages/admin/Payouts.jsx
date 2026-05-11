import { useEffect, useMemo, useState } from 'react';
import {
  Table, Tag, Typography, Button, Input, Tabs, Space, message, Popconfirm, Row, Col, Statistic, Card,
} from 'antd';
import { SearchOutlined, DollarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const COMM_COLORS = { payable: 'cyan', pending: 'gold', paid: 'green', none: 'default' };
const COMM_LABELS = { payable: 'Payout Ready', pending: 'Pending', paid: 'Paid', none: '—' };

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
      if (tab === 'pending' && l.commissionStatus !== 'pending') return false;
      if (q && !l.customerName.toLowerCase().includes(q) && !(l.leadNumber || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [leads, search, tab]);

  const payableLeads = useMemo(() => leads.filter((l) => l.commissionStatus === 'payable'), [leads]);

  const stats = useMemo(() => ({
    payable: payableLeads.length,
    pending: leads.filter((l) => l.commissionStatus === 'pending').length,
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
          <div style={{ fontSize: 12, color: '#888' }}>{row.phone}</div>
        </div>
      ),
    },
    {
      title: 'Agent',
      render: (_, row) => (
        <div>
          <div>{row.agent?.name || row.agent?.email || '—'}</div>
          {row.agent?.name && <div style={{ fontSize: 12, color: '#888' }}>{row.agent.email}</div>}
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
          <div style={{ fontWeight: 700, fontSize: 15 }}>{aed(row.commission)}</div>
          {row.grossCommission > 0 && (
            <div style={{ fontSize: 11, color: '#888' }}>Gross: {aed(row.grossCommission)}</div>
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
    { key: 'payable', label: `Payout Ready (${stats.payable})` },
    { key: 'pending', label: `Pending (${stats.pending})` },
    { key: 'paid',    label: `Paid (${stats.paid})` },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Typography.Title level={3} style={{ margin: 0 }}>Payouts</Typography.Title>
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
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Payout Ready"
              value={aed(stats.totalPayable)}
              valueStyle={{ color: '#0891b2', fontWeight: 700 }}
              suffix={<Typography.Text type="secondary" style={{ fontSize: 13 }}>{stats.payable} leads</Typography.Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Pending Commission" value={stats.pending} valueStyle={{ fontWeight: 700 }} suffix="leads" />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Total Paid Out" value={aed(stats.totalPaid)} valueStyle={{ color: '#16a34a', fontWeight: 700 }} />
          </Card>
        </Col>
      </Row>

      <Tabs activeKey={tab} onChange={(k) => { setTab(k); setSelectedRowKeys([]); }} items={tabItems} style={{ marginBottom: 8 }} />

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
        scroll={{ x: 'max-content' }}
        rowSelection={
          tab === 'payable'
            ? { selectedRowKeys, onChange: setSelectedRowKeys, getCheckboxProps: (row) => ({ disabled: row.commissionStatus !== 'payable' }) }
            : undefined
        }
        onRow={(row) => ({ onClick: () => navigate(`/admin/leads/${row._id}`), style: { cursor: 'pointer' } })}
      />
    </>
  );
}
