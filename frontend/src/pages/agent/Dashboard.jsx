import { useEffect, useState } from 'react';
import { Card, Col, Row, Typography, Statistic, Spin, Tag, Space } from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  HourglassOutlined,
  DollarOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import api from '../../api/client';

const cards = [
  { key: 'total', label: 'Total Leads', icon: <FileTextOutlined />, color: '#1677ff' },
  { key: 'active', label: 'Active', icon: <ClockCircleOutlined />, color: '#13c2c2' },
  { key: 'approved', label: 'Approved', icon: <CheckCircleOutlined />, color: '#52c41a' },
  { key: 'rejected', label: 'Rejected', icon: <CloseCircleOutlined />, color: '#ff4d4f' },
  { key: 'pending', label: 'Pending', icon: <HourglassOutlined />, color: '#faad14' },
  { key: 'earnings', label: 'Earnings', icon: <DollarOutlined />, color: '#722ed1', prefix: '$' },
];

function AgentDashboard() {
  const { user } = useSelector((s) => s.auth);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/leads/stats').then((res) => setStats(res.data));
  }, []);

  return (
    <>
      <Typography.Title level={3}>Welcome, {user.name}</Typography.Title>
      <Space size="middle" style={{ marginBottom: 24 }}>
        <Typography.Text type="secondary">Your referral code:</Typography.Text>
        <Tag color="blue" style={{ fontSize: 14, padding: '4px 8px' }}>
          <Typography.Text copyable={{ icon: <CopyOutlined />, text: user.referralCode }} style={{ color: '#1677ff' }}>
            {user.referralCode}
          </Typography.Text>
        </Tag>
      </Space>

      {!stats ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : (
        <Row gutter={[16, 16]}>
          {cards.map((c) => (
            <Col xs={24} sm={12} md={8} key={c.key}>
              <Card>
                <Statistic
                  title={c.label}
                  value={stats[c.key] || 0}
                  prefix={<span style={{ color: c.color, marginRight: 8 }}>{c.icon}</span>}
                  formatter={c.prefix === '$' ? (val) => `$${val}` : undefined}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}

export default AgentDashboard;
