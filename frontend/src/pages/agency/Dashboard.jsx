import { useEffect, useState } from 'react';
import { Card, Col, Row, Typography, Skeleton, Button, Divider } from 'antd';
import { AuditOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, DollarOutlined, RiseOutlined, BankOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const StatCard = ({ title, value, icon, iconColor, iconBg, loading }) => (
  <Card
    styles={{ body: { padding: '22px 24px' } }}
    style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', height: '100%' }}
  >
    {loading ? <Skeleton active paragraph={{ rows: 1 }} /> : (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 10 }}>
            {title}
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
            {value ?? '—'}
          </div>
        </div>
        <div style={{
          width: 50, height: 50, borderRadius: 13, background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, color: iconColor, flexShrink: 0, marginLeft: 12,
        }}>
          {icon}
        </div>
      </div>
    )}
  </Card>
);

const PayoutCard = ({ title, value, sub, icon, iconColor, valueFontColor, loading }) => (
  <Card
    styles={{ body: { padding: '20px 24px' } }}
    style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', height: '100%' }}
  >
    {loading ? <Skeleton active paragraph={{ rows: 1 }} /> : (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ color: iconColor, fontSize: 16 }}>{icon}</span>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8' }}>{title}</span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: valueFontColor || '#0f172a', lineHeight: 1, marginBottom: 4 }}>{value}</div>
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>{sub}</Typography.Text>
      </>
    )}
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
    { key: 'total', title: 'Total Leads', value: stats?.total, icon: <AuditOutlined />, iconColor: '#3b82f6', iconBg: '#eff6ff' },
    { key: 'pending', title: 'Awaiting Action', value: stats?.pending, icon: <ClockCircleOutlined />, iconColor: '#d97706', iconBg: '#fffbeb' },
    { key: 'approved', title: 'Approved', value: stats?.approved, icon: <CheckCircleOutlined />, iconColor: '#16a34a', iconBg: '#f0fdf4' },
    { key: 'rejected', title: 'Rejected', value: stats?.rejected, icon: <CloseCircleOutlined />, iconColor: '#ef4444', iconBg: '#fef2f2' },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Typography.Title level={3} style={{ margin: 0, color: '#0f172a' }}>
            Welcome, {user.name || user.email}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Review incoming leads and set commission rules.
          </Typography.Text>
        </Col>
        <Col>
          <Link to="/agency/leads">
            <Button type="primary" icon={<AuditOutlined />}>Open Lead Queue</Button>
          </Link>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {cards.map((c) => (
          <Col xs={24} sm={12} lg={6} key={c.key}>
            <StatCard {...c} loading={!stats} />
          </Col>
        ))}
      </Row>

      <Divider orientation="left" style={{ margin: '8px 0 16px' }}>
        <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>
          Admin Payouts
        </Typography.Text>
      </Divider>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <PayoutCard
            title="Expected Payout"
            value={aed(stats?.expectedPayout)}
            sub="Active leads — not yet disbursed"
            icon={<RiseOutlined />}
            iconColor="#d97706"
            valueFontColor="#d97706"
            loading={!stats}
          />
        </Col>
        <Col xs={24} sm={8}>
          <PayoutCard
            title="Total Payout to Admin"
            value={aed(stats?.totalPayout)}
            sub="Disbursed leads (paid + pending)"
            icon={<DollarOutlined />}
            iconColor="#0891b2"
            valueFontColor="#0891b2"
            loading={!stats}
          />
        </Col>
        <Col xs={24} sm={8}>
          <PayoutCard
            title="Paid to Admin"
            value={aed(stats?.paidToAdmin)}
            sub="Commissions already settled"
            icon={<BankOutlined />}
            iconColor="#16a34a"
            valueFontColor="#16a34a"
            loading={!stats}
          />
        </Col>
      </Row>
    </>
  );
}

export default AgencyDashboard;
