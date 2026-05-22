import { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Table, Tag, Empty, Skeleton, Space, Tabs, Statistic } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, RiseOutlined, DollarOutlined } from '@ant-design/icons';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;
const productLabels = { credit_card: 'Credit Card', loan: 'Loan' };

function Commissions() {
  const [ledger, setLedger] = useState(null);
  const [bonuses, setBonuses] = useState([]);

  useEffect(() => {
    api.get('/leads/ledger').then((res) => setLedger(res.data));
    api.get('/volume-bonuses').then((res) => setBonuses(res.data));
  }, []);

  const paidLeads = (ledger?.leads || []).filter((l) => l.commissionStatus === 'paid');
  const payableLeads = (ledger?.leads || []).filter((l) => l.commissionStatus === 'payable');
  const pendingLeads = (ledger?.leads || []).filter((l) => l.commissionStatus === 'pending');

  const paidColumns = [
    {
      title: 'Reference',
      dataIndex: 'leadNumber',
      render: (v) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>{v || '—'}</Typography.Text>,
    },
    { title: 'Client', dataIndex: 'customerName', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Product', dataIndex: 'productType', render: (v) => productLabels[v] },
    { title: 'Bank', dataIndex: ['bank', 'name'] },
    {
      title: 'Payout',
      dataIndex: 'commission',
      align: 'right',
      render: (v) => <span style={{ color: '#16a34a', fontWeight: 700 }}>{aed(v)}</span>,
    },
    {
      title: 'Paid On',
      dataIndex: 'commissionPaidAt',
      render: (d) => d ? new Date(d).toLocaleDateString() : '—',
    },
  ];

  const pendingPayoutColumns = [
    {
      title: 'Reference',
      dataIndex: 'leadNumber',
      render: (v) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>{v || '—'}</Typography.Text>,
    },
    { title: 'Client', dataIndex: 'customerName', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Product', dataIndex: 'productType', render: (v) => productLabels[v] },
    { title: 'Bank', dataIndex: ['bank', 'name'] },
    {
      title: 'Payout',
      dataIndex: 'commission',
      align: 'right',
      render: (v) => <span style={{ fontWeight: 700, color: '#0891b2' }}>{aed(v)}</span>,
    },
    {
      title: 'Status',
      render: () => <Tag color="cyan">Payout Ready</Tag>,
    },
  ];

  const expectedPayoutColumns = [
    {
      title: 'Reference',
      dataIndex: 'leadNumber',
      render: (v) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>{v || '—'}</Typography.Text>,
    },
    { title: 'Client', dataIndex: 'customerName', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Product', dataIndex: 'productType', render: (v) => productLabels[v] },
    { title: 'Bank', dataIndex: ['bank', 'name'] },
    {
      title: 'Expected Payout',
      dataIndex: 'commission',
      align: 'right',
      render: (v) => <span style={{ fontWeight: 700, color: '#b45309' }}>{aed(v)}</span>,
    },
    {
      title: 'Status',
      render: () => <Tag color="gold">Pending approval</Tag>,
    },
  ];

  const StatCard = ({ loading, icon, iconColor, label, value, sub, borderColor, bg, valueColor }) => (
    <Card
      size="small"
      style={{ borderRadius: 12, borderLeft: `4px solid ${borderColor}`, background: bg, border: `1px solid ${borderColor}22`, height: '100%' }}
      styles={{ body: { padding: '18px 20px' } }}
    >
      {loading ? <Skeleton active paragraph={{ rows: 1 }} /> : (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: iconColor, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>{icon}</span>{label}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: valueColor || '#1e293b', lineHeight: 1.2 }}>{value}</div>
          <div style={{ fontSize: 12, color: iconColor, marginTop: 6, opacity: 0.8 }}>{sub}</div>
        </>
      )}
    </Card>
  );

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0, fontWeight: 500 }}>Payouts &amp; Earnings</Typography.Title>
        <Typography.Text type="secondary">Track your payouts, pending settlements, and expected earnings.</Typography.Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            loading={!ledger}
            icon={<CheckCircleOutlined />}
            iconColor="#16a34a"
            label="Paid Out"
            value={aed(ledger?.paid)}
            sub={`${paidLeads.length} closed deal${paidLeads.length !== 1 ? 's' : ''}`}
            borderColor="#22c55e"
            bg="#f0fdf4"
            valueColor="#15803d"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            loading={!ledger}
            icon={<ClockCircleOutlined />}
            iconColor="#0891b2"
            label="Payout Ready"
            value={aed(ledger?.payable)}
            sub="Approved, ready to be paid"
            borderColor="#06b6d4"
            bg="#ecfeff"
            valueColor="#0e7490"
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <StatCard
            loading={!ledger}
            icon={<RiseOutlined />}
            iconColor="#b45309"
            label="Expected Earnings"
            value={aed(ledger?.pending)}
            sub="If active cases close"
            borderColor="#f59e0b"
            bg="#fffbeb"
            valueColor="#92400e"
          />
        </Col>
      </Row>

      {ledger?.monthlyBonus?.amount > 0 && (
        <div
          style={{
            marginBottom: 20,
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderLeft: '4px solid #22c55e',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <RiseOutlined style={{ color: '#16a34a', fontSize: 18 }} />
          <span style={{ color: '#15803d' }}>
            <strong>Volume bonus unlocked this month: {aed(ledger.monthlyBonus.amount)}</strong>
            {' '}— you've hit {ledger.monthlyBonus.approvedCount} approved leads (threshold {ledger.monthlyBonus.threshold}).
          </span>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '0 24px 24px' }}>
        <Tabs
          defaultActiveKey="paid"
          style={{ marginTop: 0 }}
          items={[
            {
              key: 'paid',
              label: (
                <span>
                  <CheckCircleOutlined style={{ color: '#16a34a', marginRight: 6 }} />
                  Paid ({paidLeads.length})
                </span>
              ),
              children: (
                <Table
                  size="small"
                  rowKey="_id"
                  dataSource={paidLeads}
                  columns={paidColumns}
                  scroll={{ x: 'max-content' }}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: <Empty description="No payouts yet" /> }}
                />
              ),
            },
            {
              key: 'pending_payout',
              label: (
                <span>
                  <ClockCircleOutlined style={{ color: '#0891b2', marginRight: 6 }} />
                  Payout Ready ({payableLeads.length})
                </span>
              ),
              children: (
                <Table
                  size="small"
                  rowKey="_id"
                  dataSource={payableLeads}
                  columns={pendingPayoutColumns}
                  scroll={{ x: 'max-content' }}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: <Empty description="No pending payouts" /> }}
                />
              ),
            },
            {
              key: 'expected_payout',
              label: (
                <span>
                  <RiseOutlined style={{ color: '#b45309', marginRight: 6 }} />
                  Expected Payout ({pendingLeads.length})
                </span>
              ),
              children: (
                <Table
                  size="small"
                  rowKey="_id"
                  dataSource={pendingLeads}
                  columns={expectedPayoutColumns}
                  scroll={{ x: 'max-content' }}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: <Empty description="No expected payouts" /> }}
                />
              ),
            },
          ]}
        />
      </div>

      {bonuses.filter((b) => b.active).length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 24px', marginTop: 16 }}>
          <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
            <DollarOutlined style={{ marginRight: 6, color: '#6366f1' }} />Volume Bonuses
          </Typography.Text>
          <Row gutter={[12, 12]}>
            {bonuses.filter((b) => b.active).sort((a, c) => a.threshold - c.threshold).map((b) => (
              <Col key={b._id}>
                <Card
                  size="small"
                  style={{ borderRadius: 8, borderLeft: '3px solid #6366f1', background: '#eef2ff', minWidth: 180 }}
                  styles={{ body: { padding: '10px 14px' } }}
                >
                  <Statistic
                    title={<span style={{ fontSize: 11, color: '#4f46e5' }}>{b.threshold}+ approvals/month</span>}
                    value={aed(b.amount)}
                    valueStyle={{ fontSize: 16, fontWeight: 700, color: '#4338ca' }}
                  />
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}
    </>
  );
}

export default Commissions;
