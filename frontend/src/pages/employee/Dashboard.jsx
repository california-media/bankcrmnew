import { useEffect, useState } from 'react';
import { Card, Col, Row, Typography, Skeleton, Button } from 'antd';
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
    { key: 'total', title: 'Total Assigned', value: stats?.total, icon: <AuditOutlined />, iconColor: '#3b82f6', iconBg: '#eff6ff' },
    { key: 'pending', title: 'In Progress', value: stats?.pending, icon: <ClockCircleOutlined />, iconColor: '#d97706', iconBg: '#fffbeb' },
    { key: 'approved', title: 'Approved / Disbursed', value: stats?.approved, icon: <CheckCircleOutlined />, iconColor: '#16a34a', iconBg: '#f0fdf4' },
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
            Your assigned leads overview.
          </Typography.Text>
        </Col>
        <Col>
          <Link to="/employee/leads">
            <Button type="primary" icon={<UnorderedListOutlined />}>View My Leads</Button>
          </Link>
        </Col>
      </Row>

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
