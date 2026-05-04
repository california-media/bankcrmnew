import { useEffect, useState } from 'react';
import { Card, Col, Row, Typography, Statistic, Tag, Space, Skeleton, Button, Empty } from 'antd';
import { AuditOutlined, CheckCircleOutlined, CloseCircleOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../../api/client';

function AgencyDashboard() {
  const { user } = useSelector((s) => s.auth);
  const [leads, setLeads] = useState(null);

  useEffect(() => {
    api.get('/leads/agency').then((res) => setLeads(res.data));
  }, []);

  const stats = leads
    ? {
        total: leads.length,
        unclaimed: leads.filter((l) => !l.agency).length,
        approved: leads.filter((l) => l.status === 'approved' || l.status === 'disbursed').length,
        rejected: leads.filter((l) => l.status === 'rejected').length,
      }
    : null;

  const cards = [
    { key: 'total', title: 'Leads in Queue', value: stats?.total, icon: <AuditOutlined style={{ color: '#3b82f6' }} /> },
    { key: 'unclaimed', title: 'Unclaimed', value: stats?.unclaimed, icon: <FolderOpenOutlined style={{ color: '#f59e0b' }} /> },
    { key: 'approved', title: 'Approved by you', value: stats?.approved, icon: <CheckCircleOutlined style={{ color: '#16a34a' }} /> },
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
            Review incoming leads for the banks under your remit.
          </Typography.Text>
        </Col>
        <Col>
          <Link to="/agency/leads">
            <Button type="primary" icon={<AuditOutlined />}>Open lead queue</Button>
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

      <Card title="Your assigned banks" style={{ marginTop: 24 }}>
        {(user.banks || []).length === 0 ? (
          <Empty description="No banks assigned yet — contact the admin." />
        ) : (
          <Space wrap>
            {(user.banks || []).map((b) => (
              <Tag color="blue" key={b._id || b}>{b.name || b}</Tag>
            ))}
          </Space>
        )}
      </Card>
    </>
  );
}

export default AgencyDashboard;
