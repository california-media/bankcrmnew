import { useEffect, useState } from 'react';
import { Card, Col, Row, Typography, Statistic, Space, Skeleton, Button } from 'antd';
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

function EmployeeDashboard() {
  const { user } = useSelector((s) => s.auth);
  const [leads, setLeads] = useState(null);

  useEffect(() => {
    api.get('/leads/assigned').then((res) => setLeads(res.data));
  }, []);

  const stats = leads
    ? {
        total: leads.length,
        pending: leads.filter((l) => l.status === 'submitted' || l.status === 'under_review' || l.status === 'assigned').length,
        approved: leads.filter((l) => l.status === 'approved' || l.status === 'disbursed').length,
        rejected: leads.filter((l) => l.status === 'rejected').length,
      }
    : null;

  const cards = [
    { key: 'total', title: 'Total Assigned', value: stats?.total, icon: <AuditOutlined style={{ color: '#3b82f6' }} /> },
    { key: 'pending', title: 'In Progress', value: stats?.pending, icon: <ClockCircleOutlined style={{ color: '#f59e0b' }} /> },
    { key: 'approved', title: 'Approved / Disbursed', value: stats?.approved, icon: <CheckCircleOutlined style={{ color: '#16a34a' }} /> },
    { key: 'rejected', title: 'Rejected', value: stats?.rejected, icon: <CloseCircleOutlined style={{ color: '#ef4444' }} /> },
  ];

  return (
    <>
      <Row justify="space-between" align="middle">
        <Col>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Welcome, {user.name || user.email}
          </Typography.Title>
          <Typography.Text type="secondary">
            Your assigned leads overview.
          </Typography.Text>
        </Col>
        <Col>
          <Link to="/employee/leads">
            <Button type="primary" icon={<UnorderedListOutlined />}>View My Leads</Button>
          </Link>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {cards.map((c) => (
          <Col xs={24} sm={12} lg={6} key={c.key}>
            <Card>
              {!stats ? <Skeleton active paragraph={{ rows: 1 }} /> : (
                <Statistic
                  title={<Space>{c.icon}<span style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>{c.title}</span></Space>}
                  value={c.value}
                  valueStyle={{ fontSize: 28, fontWeight: 700 }}
                />
              )}
            </Card>
          </Col>
        ))}
      </Row>
    </>
  );
}

export default EmployeeDashboard;
