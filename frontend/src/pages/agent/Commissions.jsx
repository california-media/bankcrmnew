import { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Statistic, Table, Tag, Empty, Skeleton, Space } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, RiseOutlined } from '@ant-design/icons';
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
      dataIndex: '_id',
      render: (id) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>LD-{String(id).slice(-6)}</Typography.Text>,
    },
    { title: 'Client', dataIndex: 'customerName', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Product', dataIndex: 'productType', render: (v) => productLabels[v] },
    { title: 'Bank', dataIndex: ['bank', 'name'] },
    { title: 'Agency', render: (_, row) => row.agency?.name || row.agency?.email || '—' },
    {
      title: 'Commission',
      dataIndex: 'commission',
      align: 'right',
      render: (v) => <span style={{ color: '#16a34a', fontWeight: 600 }}>{aed(v)}</span>,
    },
    {
      title: 'Paid On',
      dataIndex: 'commissionPaidAt',
      render: (d) => d ? new Date(d).toLocaleDateString() : '—',
    },
  ];

  const pendingColumns = [
    {
      title: 'Reference',
      dataIndex: '_id',
      render: (id) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>LD-{String(id).slice(-6)}</Typography.Text>,
    },
    { title: 'Client', dataIndex: 'customerName', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Product', dataIndex: 'productType', render: (v) => productLabels[v] },
    { title: 'Bank', dataIndex: ['bank', 'name'] },
    { title: 'Agency', render: (_, row) => row.agency?.name || row.agency?.email || '—' },
    {
      title: 'Commission',
      dataIndex: 'commission',
      align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>{aed(v)}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'commissionStatus',
      render: (s) => s === 'payable'
        ? <Tag color="cyan">Awaiting payment</Tag>
        : <Tag color="gold">Pending approval</Tag>,
    },
  ];

  return (
    <>
      <Typography.Title level={3} style={{ margin: 0 }}>Commissions &amp; Earnings</Typography.Title>
      <Typography.Text type="secondary">Track your payouts, pending settlements, and expected earnings.</Typography.Text>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card style={{ background: '#fdf6e3', borderColor: '#d4a847' }}>
            {!ledger ? <Skeleton active paragraph={{ rows: 1 }} /> : (
              <Statistic
                title={<Space><CheckCircleOutlined style={{ color: '#16a34a' }} /><span>PAID OUT</span></Space>}
                value={aed(ledger.paid)}
                valueStyle={{ fontSize: 24, fontWeight: 700 }}
              />
            )}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{paidLeads.length} closed deals</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            {!ledger ? <Skeleton active paragraph={{ rows: 1 }} /> : (
              <Statistic
                title={<Space><ClockCircleOutlined style={{ color: '#3b82f6' }} /><span>PENDING PAYOUT</span></Space>}
                value={aed(ledger.payable)}
                valueStyle={{ fontSize: 24, fontWeight: 700 }}
              />
            )}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>Disbursed, awaiting payment</Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            {!ledger ? <Skeleton active paragraph={{ rows: 1 }} /> : (
              <Statistic
                title={<Space><RiseOutlined style={{ color: '#f59e0b' }} /><span>EXPECTED EARNINGS</span></Space>}
                value={aed(ledger.pending)}
                valueStyle={{ fontSize: 24, fontWeight: 700 }}
              />
            )}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>If active cases close</Typography.Text>
          </Card>
        </Col>
      </Row>

      {ledger?.monthlyBonus?.amount > 0 && (
        <Card style={{ marginTop: 16, background: '#f0fdf4', borderColor: '#86efac' }}>
          <Space>
            <RiseOutlined style={{ color: '#16a34a', fontSize: 18 }} />
            <span>
              <strong>Volume bonus unlocked this month: {aed(ledger.monthlyBonus.amount)}</strong>
              {' '}— you've hit {ledger.monthlyBonus.approvedCount} approved leads (threshold {ledger.monthlyBonus.threshold}).
            </span>
          </Space>
        </Card>
      )}

      <Card title="Commission Payments" style={{ marginTop: 24 }} extra={<Typography.Text type="secondary">{paidLeads.length} payments received</Typography.Text>}>
        <Table
          rowKey="_id"
          dataSource={paidLeads}
          columns={paidColumns}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="No payouts yet" /> }}
        />
      </Card>

      <Card title="Pending Payouts" style={{ marginTop: 16 }} extra={<Typography.Text type="secondary">Cases awaiting commission settlement</Typography.Text>}>
        <Table
          rowKey="_id"
          dataSource={[...payableLeads, ...pendingLeads]}
          columns={pendingColumns}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="No pending payouts" /> }}
        />
      </Card>

      {bonuses.filter((b) => b.active).length > 0 && (
        <Card title="Volume Bonuses" style={{ marginTop: 16 }}>
          <Space wrap>
            {bonuses.filter((b) => b.active).sort((a, b) => a.threshold - b.threshold).map((b) => (
              <Card size="small" key={b._id} style={{ minWidth: 200 }}>
                <Statistic
                  title={`${b.threshold}+ approvals/month`}
                  value={aed(b.amount)}
                  valueStyle={{ fontSize: 18 }}
                />
              </Card>
            ))}
          </Space>
        </Card>
      )}
    </>
  );
}

export default Commissions;
