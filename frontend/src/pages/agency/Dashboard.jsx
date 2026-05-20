import { useEffect, useState } from 'react';
import { Card, Col, Row, Typography, Skeleton, Button } from 'antd';
import { AuditOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, DollarOutlined, RiseOutlined, BankOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const StatCard = ({ title, value, icon, gradient, loading }) =>
  loading ? (
    <Card styles={{ body: { padding: '22px 24px' } }} style={{ borderRadius: 16, border: '1px solid #e2e8f0', height: '100%' }}>
      <Skeleton active paragraph={{ rows: 1 }} />
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
      <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
        {value ?? '—'}
      </div>
    </Card>
  );

const PayoutCard = ({ title, value, sub, icon, gradient, loading }) =>
  loading ? (
    <Card styles={{ body: { padding: '20px 24px' } }} style={{ borderRadius: 16, border: '1px solid #e2e8f0', height: '100%' }}>
      <Skeleton active paragraph={{ rows: 1 }} />
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
      <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1, marginBottom: 8 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.68)' }}>{sub}</div>
    </Card>
  );

function AgencyDashboard() {
  const { user } = useSelector((s) => s.auth);
  const [leads, setLeads] = useState(null);

  useEffect(() => {
    api.get('/leads/agency').then((res) => setLeads(res.data));
  }, []);

  const stats = leads
    ? {
        total: leads.length,
        pending: leads.filter((l) => ['submitted', 'under_review', 'assigned'].includes(l.status)).length,
        approved: leads.filter((l) => ['approved', 'disbursed'].includes(l.status)).length,
        rejected: leads.filter((l) => l.status === 'rejected').length,
        expectedPayout: leads.filter((l) => l.commissionStatus === 'pending').reduce((s, l) => s + (l.grossCommission || 0), 0),
        totalPayout: leads.filter((l) => ['payable', 'paid'].includes(l.commissionStatus)).reduce((s, l) => s + (l.grossCommission || 0), 0),
        paidToAdmin: leads.filter((l) => l.commissionStatus === 'paid').reduce((s, l) => s + (l.grossCommission || 0), 0),
      }
    : null;

  const cards = [
    { key: 'total', title: 'Total Leads', value: stats?.total, icon: <AuditOutlined />, gradient: 'linear-gradient(135deg, #1d4ed8 0%, #60a5fa 100%)' },
    { key: 'pending', title: 'Awaiting Action', value: stats?.pending, icon: <ClockCircleOutlined />, gradient: 'linear-gradient(135deg, #b45309 0%, #fbbf24 100%)' },
    { key: 'approved', title: 'Approved', value: stats?.approved, icon: <CheckCircleOutlined />, gradient: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)' },
    { key: 'rejected', title: 'Rejected', value: stats?.rejected, icon: <CloseCircleOutlined />, gradient: 'linear-gradient(135deg, #b91c1c 0%, #f87171 100%)' },
  ];

  const payoutCards = [
    { key: 'expected', title: 'Expected Payout', value: aed(stats?.expectedPayout), sub: 'Active leads — not yet disbursed', icon: <RiseOutlined />, gradient: 'linear-gradient(135deg, #b45309 0%, #fbbf24 100%)' },
    { key: 'total', title: 'Total Payout to Admin', value: aed(stats?.totalPayout), sub: 'Disbursed leads (paid + pending)', icon: <DollarOutlined />, gradient: 'linear-gradient(135deg, #0369a1 0%, #38bdf8 100%)' },
    { key: 'paid', title: 'Paid to Admin', value: aed(stats?.paidToAdmin), sub: 'Commissions already settled', icon: <BankOutlined />, gradient: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)' },
  ];

  return (
    <>
      {/* Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 55%, #7c3aed 100%)',
        borderRadius: 16,
        padding: '28px 32px',
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 8px 32px rgba(109,40,217,0.25)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -50, top: -50, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', right: 100, bottom: -70, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            Welcome, {user.name || user.email} 👋
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.68)' }}>
            Review incoming leads and set commission rules.
          </div>
        </div>
        <Link to="/agency/leads">
          <Button
            icon={<AuditOutlined />}
            size="middle"
            style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)', color: '#fff', borderRadius: 8, fontWeight: 600 }}
          >
            Open Lead Queue
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

      {/* Payout Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 4, height: 20, borderRadius: 2, background: 'linear-gradient(180deg, #6d28d9, #a78bfa)' }} />
        <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#64748b' }}>Admin Payouts</span>
      </div>

      <Row gutter={[16, 16]}>
        {payoutCards.map((c) => (
          <Col xs={24} sm={8} key={c.key}>
            <PayoutCard {...c} loading={!stats} />
          </Col>
        ))}
      </Row>
    </>
  );
}

export default AgencyDashboard;
