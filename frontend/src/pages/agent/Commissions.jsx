import { useEffect, useState, useMemo } from 'react';
import { Card, Row, Col, Typography, Table, Tag, Empty, Skeleton, Space, Tabs, Statistic } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, RiseOutlined, DollarOutlined, LockOutlined } from '@ant-design/icons';
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
  const heldLeads = (ledger?.leads || []).filter((l) => l.holdAmount > 0 && !l.holdReleased && l.productType === 'credit_card');

  const paidRows = useMemo(() => {
    const rows = [];
    paidLeads.forEach((l) => {
      const holdAmt = l.holdAmount || 0;
      const stillHeld = holdAmt > 0 && !l.holdReleased;
      rows.push({ ...l, _rowKey: `${l._id}_pay`, _type: 'payout', _amount: (l.commission || 0) - holdAmt, _date: l.commissionPaidAt });
      if (holdAmt > 0 && l.holdReleased) {
        rows.push({ ...l, _rowKey: `${l._id}_hold`, _type: 'hold_release', _amount: holdAmt, _date: l.holdReleasedAt });
      }
    });
    return rows.sort((a, b) => new Date(b._date || 0) - new Date(a._date || 0));
  }, [paidLeads]);

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
      title: 'Type',
      render: (_, row) => row._type === 'hold_release'
        ? <Tag color="purple" style={{ fontSize: 11 }}>Hold Released</Tag>
        : <Tag color="green" style={{ fontSize: 11 }}>Payout</Tag>,
    },
    {
      title: 'Amount',
      align: 'right',
      render: (_, row) => (
        <span style={{ color: row._type === 'hold_release' ? '#7c3aed' : '#16a34a', fontWeight: 700 }}>
          {aed(row._amount)}
        </span>
      ),
    },
    {
      title: 'Date',
      render: (_, row) => row._date ? new Date(row._date).toLocaleDateString() : '—',
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
        <Col xs={24} sm={12} lg={6}>
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
        <Col xs={24} sm={12} lg={6}>
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
        <Col xs={24} sm={12} lg={6}>
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
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            loading={!ledger}
            icon={<LockOutlined />}
            iconColor="#7c3aed"
            label="On Hold"
            value={aed(ledger?.held)}
            sub={`${heldLeads.length} hold${heldLeads.length !== 1 ? 's' : ''} — pending release`}
            borderColor="#a855f7"
            bg="#faf5ff"
            valueColor="#6b21a8"
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
                  rowKey="_rowKey"
                  dataSource={paidRows}
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
            ...(heldLeads.length > 0 ? [{
              key: 'held',
              label: (
                <span>
                  <LockOutlined style={{ color: '#7c3aed', marginRight: 6 }} />
                  On Hold ({heldLeads.length})
                </span>
              ),
              children: (
                <Table
                  size="small"
                  rowKey="_id"
                  dataSource={heldLeads}
                  columns={[
                    { title: 'Reference', dataIndex: 'leadNumber', render: (v) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>{v || '—'}</Typography.Text> },
                    { title: 'Client', dataIndex: 'customerName', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
                    { title: 'Bank', dataIndex: ['bank', 'name'] },
                    { title: 'Commission', dataIndex: 'commission', align: 'right', render: (v) => <span style={{ fontWeight: 700 }}>{aed(v)}</span> },
                    {
                      title: 'On Hold',
                      dataIndex: 'holdAmount',
                      align: 'right',
                      render: (v, row) => (
                        <div>
                          <span style={{ fontWeight: 700, color: '#7c3aed' }}>{aed(v)}</span>
                          {row.clawbackUntil && (
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>Until {new Date(row.clawbackUntil).toLocaleDateString()}</div>
                          )}
                        </div>
                      ),
                    },
                    { title: 'Paid On', dataIndex: 'commissionPaidAt', render: (d) => d ? new Date(d).toLocaleDateString() : '—' },
                  ]}
                  scroll={{ x: 'max-content' }}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: <Empty description="No holds" /> }}
                />
              ),
            }] : []),
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
