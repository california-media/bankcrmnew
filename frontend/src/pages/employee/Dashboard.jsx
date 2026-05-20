import { useEffect, useState } from 'react';
import { Card, Col, Row, Skeleton, Button } from 'antd';
import {
  AuditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../../api/client';

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

function EmployeeDashboard() {
  const { user } = useSelector((s) => s.auth);
  const [leads, setLeads] = useState(null);

  useEffect(() => {
    api.get('/leads/assigned').then((res) => setLeads(res.data));
  }, []);

  const stats = leads
    ? {
        total: leads.length,
        pending: leads.filter((l) => ['submitted', 'under_review', 'assigned'].includes(l.status)).length,
        approved: leads.filter((l) => ['approved', 'disbursed'].includes(l.status)).length,
        rejected: leads.filter((l) => l.status === 'rejected').length,
      }
    : null;

  const cards = [
    { key: 'total', title: 'Total Assigned', value: stats?.total, icon: <AuditOutlined />, gradient: 'linear-gradient(135deg, #1d4ed8 0%, #60a5fa 100%)' },
    { key: 'pending', title: 'In Progress', value: stats?.pending, icon: <ClockCircleOutlined />, gradient: 'linear-gradient(135deg, #b45309 0%, #fbbf24 100%)' },
    { key: 'approved', title: 'Approved / Disbursed', value: stats?.approved, icon: <CheckCircleOutlined />, gradient: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)' },
    { key: 'rejected', title: 'Rejected', value: stats?.rejected, icon: <CloseCircleOutlined />, gradient: 'linear-gradient(135deg, #b91c1c 0%, #f87171 100%)' },
  ];

  return (
    <>
      {/* Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 55%, #0ea5e9 100%)',
        borderRadius: 16,
        padding: '28px 32px',
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 8px 32px rgba(3,105,161,0.25)',
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
            Your assigned leads overview.
          </div>
        </div>
        <Link to="/employee/leads">
          <Button
            icon={<UnorderedListOutlined />}
            size="middle"
            style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)', color: '#fff', borderRadius: 8, fontWeight: 600 }}
          >
            View My Leads
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col xs={24} sm={12} lg={6} key={c.key}>
            <StatCard {...c} loading={!leads} />
          </Col>
        ))}
      </Row>
    </>
  );
}

export default EmployeeDashboard;
