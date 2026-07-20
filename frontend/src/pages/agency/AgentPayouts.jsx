import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Input, Card, Row, Col, Statistic } from 'antd';
import { SearchOutlined, DollarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const COMM_COLORS = { payable: 'cyan', pending: 'gold', paid: 'green', none: 'default' };
const COMM_LABELS = { payable: 'Payout Ready', pending: 'Pending', paid: 'Paid', none: '—' };

const cardStyle = { borderRadius: 12, borderTop: '3px solid #7C3AED' };

export default function AgencyAgentPayouts() {
  const navigate = useNavigate();
  const [leads, setLeads]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/leads/agency')
      .then(({ data }) => setLeads(data.filter((l) => l.commissionStatus && l.commissionStatus !== 'none')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.customerName?.toLowerCase().includes(q) ||
      l.leadId?.toLowerCase().includes(q) ||
      l.agent?.name?.toLowerCase().includes(q) ||
      l.bank?.name?.toLowerCase().includes(q)
    );
  });

  const totalPaid    = leads.filter((l) => l.commissionStatus === 'paid').reduce((s, l) => s + (l.commission || 0), 0);
  const totalPayable = leads.filter((l) => l.commissionStatus === 'payable').reduce((s, l) => s + (l.commission || 0), 0);
  const totalPending = leads.filter((l) => l.commissionStatus === 'pending').reduce((s, l) => s + (l.commission || 0), 0);

  const columns = [
    {
      title: 'Lead',
      dataIndex: 'leadNumber',
      render: (v, row) => (
        <a style={{ fontFamily: 'monospace', fontWeight: 600, color: '#7C3AED' }}
          onClick={() => navigate(`/agency/leads/${row._id}`)}>
          {v || row._id}
        </a>
      ),
    },
    {
      title: 'Agent',
      render: (_, row) => row.agent?.name || '—',
    },
    {
      title: 'Client',
      dataIndex: 'customerName',
    },
    {
      title: 'Bank / Product',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{row.bank?.name || '—'}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{row.cardProduct?.name || row.loanProduct?.name || '—'}</div>
        </div>
      ),
    },
    {
      title: 'Gross Commission',
      render: (_, row) => aed(row.grossCommission),
      align: 'right',
    },
    {
      title: 'Agent Payout',
      render: (_, row) => <span style={{ fontWeight: 700 }}>{aed(row.commission)}</span>,
      align: 'right',
    },
    {
      title: 'Status',
      dataIndex: 'commissionStatus',
      render: (v) => <Tag color={COMM_COLORS[v] || 'default'}>{COMM_LABELS[v] || v}</Tag>,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Agent Payouts</Typography.Title>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Admin payouts to your agents</div>
      </div>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card style={cardStyle}>
            <Statistic title="Total Paid" value={totalPaid} prefix="AED" valueStyle={{ color: '#16a34a', fontWeight: 700 }} formatter={(v) => Number(v).toLocaleString()} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={cardStyle}>
            <Statistic title="Ready to Pay" value={totalPayable} prefix="AED" valueStyle={{ color: '#0891b2', fontWeight: 700 }} formatter={(v) => Number(v).toLocaleString()} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={cardStyle}>
            <Statistic title="Pending" value={totalPending} prefix="AED" valueStyle={{ color: '#d97706', fontWeight: 700 }} formatter={(v) => Number(v).toLocaleString()} />
          </Card>
        </Col>
      </Row>

      <Card style={cardStyle}>
        <Input
          placeholder="Search agent, client, lead ID, bank…"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 340, marginBottom: 16, borderRadius: 8 }}
          allowClear
        />
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="_id"
          loading={loading}
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: 'No payout records yet' }}
        />
      </Card>
    </div>
  );
}
