import { useEffect, useState } from 'react';
import { Card, Col, Row, Typography, Statistic, Tag, Space, Table, Button, Skeleton } from 'antd';
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
  submitted: { color: 'default', label: 'Submitted' },
  under_review: { color: 'gold', label: 'Under Review' },
  assigned: { color: 'cyan', label: 'Assigned' },
  approved: { color: 'green', label: 'Approved' },
  rejected: { color: 'red', label: 'Rejected' },
  disbursed: { color: 'purple', label: 'Disbursed' },
};

const productLabels = { credit_card: 'Credit Card', loan: 'Loan' };

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

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
    {
      key: 'paid',
      title: 'Commission Earned',
      value: aed(stats?.paidEarnings),
      sub: 'Lifetime payout',
      icon: <DollarOutlined style={{ color: '#d4a847' }} />,
      highlighted: true,
    },
    {
      key: 'pending',
      title: 'Pending Commission',
      value: aed(stats?.pendingEarnings),
      sub: `Across ${stats?.active || 0} active cases`,
      icon: <ClockCircleOutlined style={{ color: '#3b82f6' }} />,
    },
    {
      key: 'active',
      title: 'Active Cases',
      value: stats?.active ?? 0,
      sub: 'In pipeline',
      icon: <FolderOpenOutlined style={{ color: '#f59e0b' }} />,
    },
    {
      key: 'closed',
      title: 'Closed Deals',
      value: stats?.disbursed ?? 0,
      sub: 'Successfully paid',
      icon: <CheckCircleOutlined style={{ color: '#16a34a' }} />,
    },
  ];

  const columns = [
    {
      title: 'Lead ID',
      dataIndex: '_id',
      render: (id) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>LD-{String(id).slice(-6)}</Typography.Text>,
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
    { title: 'Product', dataIndex: 'productType', render: (v) => productLabels[v] },
    {
      title: 'Stage',
      dataIndex: 'status',
      render: (s) => <Tag color={statusTag[s]?.color}>{statusTag[s]?.label || s}</Tag>,
    },
    {
      title: 'Est. Commission',
      dataIndex: 'commission',
      align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>{aed(v)}</span>,
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Welcome back, {(user.name || user.email).split(' ')[0]} 👋
          </Typography.Title>
          <Typography.Text type="secondary">Here's what's happening with your portfolio today.</Typography.Text>
        </Col>
        <Col>
          <Link to="/agent/leads/new">
            <Button type="primary" icon={<PlusOutlined />}>Submit New Lead</Button>
          </Link>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {cards.map((c) => (
          <Col xs={24} sm={12} lg={6} key={c.key}>
            <Card
              style={c.highlighted ? { background: '#fdf6e3', borderColor: '#d4a847' } : undefined}
            >
              {!stats ? (
                <Skeleton active paragraph={{ rows: 1 }} />
              ) : (
                <Statistic
                  title={
                    <Space>
                      {c.icon}
                      <span style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>{c.title}</span>
                    </Space>
                  }
                  value={c.value}
                  valueStyle={{ fontSize: 24, fontWeight: 700 }}
                />
              )}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{c.sub}</Typography.Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={16}>
          <Card
            title="Recent Leads"
            extra={<Link to="/agent/leads">View all →</Link>}
          >
            <Table
              rowKey="_id"
              loading={loadingRecent}
              dataSource={recent}
              columns={columns}
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Your Profile">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div
                  style={{
                    width: 64, height: 64, borderRadius: '50%', background: '#1f2937', color: '#fff',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, fontWeight: 700,
                  }}
                >
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
                <div style={{ fontWeight: 700, marginTop: 8 }}>{user.name || user.email}</div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{user.email}</Typography.Text>
              </div>
              <Card size="small" style={{ background: '#fafafa' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#888', marginBottom: 4 }}>
                  Referral Code
                </div>
                <Typography.Text
                  copyable={{ icon: <CopyOutlined />, text: user.referralCode }}
                  style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700 }}
                >
                  {user.referralCode}
                </Typography.Text>
              </Card>
            </Space>
          </Card>
        </Col>
      </Row>
    </>
  );
}

export default AgentDashboard;
