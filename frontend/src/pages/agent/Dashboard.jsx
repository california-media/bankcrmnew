import { useEffect, useState } from 'react';
import { Card, Col, Row, Typography, Tag, Space, Table, Button, Skeleton } from 'antd';
import {
  DollarOutlined,
  ClockCircleOutlined,
  FolderOpenOutlined,
  CheckCircleOutlined,
  PlusOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../../api/client';

const statusTag = {
  draft: { color: 'default', label: 'Draft' },
  submitted: { color: 'blue', label: 'New Lead' },
  under_review: { color: 'gold', label: 'Under Review' },
  assigned: { color: 'cyan', label: 'Assigned' },
  approved: { color: 'green', label: 'Approved' },
  rejected: { color: 'red', label: 'Rejected' },
  disbursed: { color: 'purple', label: 'Disbursed' },
};

const productLabels = { credit_card: 'Credit Card', loan: 'Loan' };
const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const PIPELINE_STAGES = [
  { key: 'submitted',    label: 'NEW',       bg: '#e0f7fa', border: '#a5f3fc', dot: '#06b6d4', text: '#0e7490' },
  { key: 'approved',     label: 'APPROVED',  bg: '#f3e8ff', border: '#d8b4fe', dot: '#a855f7', text: '#7e22ce' },
  { key: 'cpvDone',      label: 'CPV DONE',  bg: '#fef9c3', border: '#fde047', dot: '#eab308', text: '#a16207' },
  { key: 'activateDone', label: 'ACTIVATED', bg: '#e0f2fe', border: '#7dd3fc', dot: '#0ea5e9', text: '#0369a1' },
  { key: 'disbursed',    label: 'PAID',      bg: '#dcfce7', border: '#86efac', dot: '#22c55e', text: '#15803d' },
];

const LeadPipeline = ({ stats }) => {
  const max = Math.max(1, ...PIPELINE_STAGES.map((s) => stats?.[s.key] ?? 0));
  return (
    <Card
      title={
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Lead Pipeline</div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400, marginTop: 2 }}>
            New → Approved → CPV Done → Activated → Paid
          </div>
        </div>
      }
      extra={<Link to="/agent/leads" style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>View all →</Link>}
      style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      styles={{ header: { borderBottom: '1px solid #f1f5f9', paddingTop: 16, paddingBottom: 12 }, body: { padding: '16px 24px' } }}
    >
      {PIPELINE_STAGES.map((stage) => {
        const count = stats?.[stage.key] ?? 0;
        const pct = Math.max(count === 0 ? 2 : (count / max) * 100, 2);
        return (
          <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            {/* Label pill */}
            <div style={{ width: 100, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, background: stage.bg, border: `1.5px solid ${stage.border}`, fontSize: 10, fontWeight: 700, color: stage.text, whiteSpace: 'nowrap' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: stage.dot, flexShrink: 0 }} />
              {stage.label}
            </div>
            {/* Bar track */}
            <div style={{ flex: 1, height: 22, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                borderRadius: 999,
                background: 'linear-gradient(90deg, #7c3aed 0%, #4f46e5 45%, #3b82f6 100%)',
                transition: 'width 0.4s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                paddingRight: count > 0 ? 12 : 0,
              }}>
                {count > 0 && pct > 16 && (
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{count}</span>
                )}
              </div>
            </div>
            {/* Count outside bar when bar too small */}
            <div style={{ width: 24, textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#334155', flexShrink: 0 }}>
              {(count === 0 || pct <= 16) ? count : ''}
            </div>
          </div>
        );
      })}
    </Card>
  );
};

const StatCard = ({ title, value, sub, icon, gradient, loading }) =>
  loading ? (
    <Card styles={{ body: { padding: '22px 24px' } }} style={{ borderRadius: 16, border: '1px solid #e2e8f0', height: '100%' }}>
      <Skeleton active paragraph={{ rows: 2 }} />
    </Card>
  ) : (
    <Card
      styles={{ body: { padding: '24px', position: 'relative', overflow: 'hidden' } }}
      style={{ borderRadius: 16, border: 'none', background: gradient, boxShadow: '0 6px 24px rgba(0,0,0,0.13)', height: '100%', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', right: -12, top: -12, fontSize: 88, color: 'rgba(255,255,255,0.13)', lineHeight: 1, pointerEvents: 'none' }}>
        {icon}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: 'rgba(255,255,255,0.72)', marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', lineHeight: 1, marginBottom: sub ? 8 : 0 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.68)' }}>{sub}</div>}
    </Card>
  );

function AgentDashboard() {
  const { user } = useSelector((s) => s.auth);
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    api.get('/leads/stats').then((res) => setStats(res.data));
    api.get('/leads/mine').then((res) => setRecent(res.data.slice(0, 6))).finally(() => setLoadingRecent(false));
  }, []);

  const cards = [
    { key: 'paid', title: 'Payout Earned', value: aed(stats?.paidEarnings), sub: 'Lifetime payout', icon: <DollarOutlined />, gradient: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)' },
    { key: 'pending', title: 'Pending Payout', value: aed(stats?.pendingEarnings), sub: `Across ${stats?.active || 0} active cases`, icon: <ClockCircleOutlined />, gradient: 'linear-gradient(135deg, #1d4ed8 0%, #60a5fa 100%)' },
    { key: 'active', title: 'Active Cases', value: stats?.active ?? 0, sub: 'In pipeline', icon: <FolderOpenOutlined />, gradient: 'linear-gradient(135deg, #b45309 0%, #fbbf24 100%)' },
    { key: 'closed', title: 'Closed Deals', value: stats?.disbursed ?? 0, sub: 'Successfully disbursed', icon: <CheckCircleOutlined />, gradient: 'linear-gradient(135deg, #6d28d9 0%, #a78bfa 100%)' },
  ];

  const columns = [
    {
      title: 'Lead ID',
      dataIndex: 'leadNumber',
      render: (v) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>{v || '—'}</Typography.Text>,
    },
    {
      title: 'Client',
      dataIndex: 'customerName',
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{row.bank?.name}</div>
        </div>
      ),
    },
    { title: 'Product', dataIndex: 'productType', render: (v) => productLabels[v] || v },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s) => <Tag color={statusTag[s]?.color}>{statusTag[s]?.label || s}</Tag>,
    },
    {
      title: 'Expected Earning',
      align: 'right',
      render: (_, row) => (
        <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
          <span style={{ fontWeight: 600 }}>{aed(row.commission)}</span>
          {row.commissionStatus !== 'none' && (
            <Tag
              color={row.commissionStatus === 'paid' ? 'green' : row.commissionStatus === 'payable' ? 'cyan' : 'gold'}
              style={{ marginInlineEnd: 0, marginTop: 2 }}
            >
              {row.commissionStatus === 'paid' ? 'Received' : row.commissionStatus === 'payable' ? 'Payout Ready' : 'Pending'}
            </Tag>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      {/* Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 55%, #1d4ed8 100%)',
        borderRadius: 16,
        padding: '28px 32px',
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 8px 32px rgba(29,78,216,0.22)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -50, top: -50, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', right: 100, bottom: -70, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            Welcome back, {(user.name || user.email).split(' ')[0]} 👋
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.68)' }}>
            Here's what's happening with your portfolio today.
          </div>
        </div>
        <Link to="/agent/leads/new">
          <Button
            icon={<PlusOutlined />}
            size="middle"
            style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)', color: '#fff', borderRadius: 8, fontWeight: 600 }}
          >
            Submit New Lead
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {cards.map((c) => (
          <Col xs={24} sm={12} lg={6} key={c.key}>
            <StatCard {...c} loading={!stats} />
          </Col>
        ))}
      </Row>

      {/* Recent Leads + Right Column */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={<span style={{ fontWeight: 700, fontSize: 15 }}>Recent Leads</span>}
            extra={<Link to="/agent/leads" style={{ fontSize: 13, color: '#3b82f6' }}>View all →</Link>}
            style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            styles={{ header: { borderBottom: '2px solid #f1f5f9' } }}
          >
            <Table
              size="small"
              rowKey="_id"
              loading={loadingRecent}
              dataSource={recent}
              columns={columns}
              pagination={false}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
            <LeadPipeline stats={stats} />
          <Card
            style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflow: 'hidden' }}
            styles={{ body: { padding: 0 } }}
          >
            <div style={{
              background: 'linear-gradient(135deg, #1e1b4b 0%, #1d4ed8 100%)',
              padding: '28px 24px 52px',
              textAlign: 'center',
              position: 'relative',
            }}>
              <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                border: '3px solid rgba(255,255,255,0.4)',
                color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, fontWeight: 700,
              }}>
                {(user.name || user.email)[0].toUpperCase()}
              </div>
              <div style={{ fontWeight: 700, marginTop: 10, fontSize: 16, color: '#fff' }}>{user.name || user.email}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{user.email}</div>
            </div>
            <div style={{ padding: '0 24px 20px', marginTop: -28 }}>
              <Card size="small" style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>
                  Referral Code
                </div>
                <Typography.Text
                  copyable={{ icon: <CopyOutlined />, text: user.referralCode }}
                  style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 800, color: '#1d4ed8' }}
                >
                  {user.referralCode}
                </Typography.Text>
              </Card>
            </div>
          </Card>
          </div>
        </Col>
      </Row>
    </>
  );
}

export default AgentDashboard;
