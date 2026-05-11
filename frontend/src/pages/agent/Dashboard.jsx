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
  submitted: { color: 'blue', label: 'Submitted' },
  under_review: { color: 'gold', label: 'Under Review' },
  assigned: { color: 'cyan', label: 'Assigned' },
  approved: { color: 'green', label: 'Approved' },
  rejected: { color: 'red', label: 'Rejected' },
  disbursed: { color: 'purple', label: 'Disbursed' },
};

const productLabels = { credit_card: 'Credit Card', loan: 'Loan' };
const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const StatCard = ({ title, value, sub, icon, iconColor, iconBg, loading }) => (
  <Card
    styles={{ body: { padding: '22px 24px' } }}
    style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', height: '100%' }}
  >
    {loading ? <Skeleton active paragraph={{ rows: 2 }} /> : (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sub ? 8 : 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 10 }}>
              {title}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
              {value}
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
        {sub && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{sub}</Typography.Text>}
      </>
    )}
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
    { key: 'paid', title: 'Commission Earned', value: aed(stats?.paidEarnings), sub: 'Lifetime payout', icon: <DollarOutlined />, iconColor: '#16a34a', iconBg: '#f0fdf4' },
    { key: 'pending', title: 'Pending Commission', value: aed(stats?.pendingEarnings), sub: `Across ${stats?.active || 0} active cases`, icon: <ClockCircleOutlined />, iconColor: '#3b82f6', iconBg: '#eff6ff' },
    { key: 'active', title: 'Active Cases', value: stats?.active ?? 0, sub: 'In pipeline', icon: <FolderOpenOutlined />, iconColor: '#d97706', iconBg: '#fffbeb' },
    { key: 'closed', title: 'Closed Deals', value: stats?.disbursed ?? 0, sub: 'Successfully disbursed', icon: <CheckCircleOutlined />, iconColor: '#16a34a', iconBg: '#f0fdf4' },
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
      title: 'Stage',
      dataIndex: 'status',
      render: (s) => <Tag color={statusTag[s]?.color}>{statusTag[s]?.label || s}</Tag>,
    },
    {
      title: 'Commission',
      align: 'right',
      render: (_, row) => (
        <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
          <span style={{ fontWeight: 600 }}>{aed(row.commission)}</span>
          {row.commissionStatus !== 'none' && (
            <Tag
              color={row.commissionStatus === 'paid' ? 'green' : row.commissionStatus === 'payable' ? 'cyan' : 'gold'}
              style={{ marginInlineEnd: 0, marginTop: 2 }}
            >
              {row.commissionStatus === 'paid' ? 'Paid' : row.commissionStatus === 'payable' ? 'Payout Ready' : 'Pending'}
            </Tag>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Typography.Title level={3} style={{ margin: 0, color: '#0f172a' }}>
            Welcome back, {(user.name || user.email).split(' ')[0]} 👋
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Here's what's happening with your portfolio today.
          </Typography.Text>
        </Col>
        <Col>
          <Link to="/agent/leads/new">
            <Button type="primary" icon={<PlusOutlined />} size="middle">Submit New Lead</Button>
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

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={<span style={{ fontWeight: 700 }}>Recent Leads</span>}
            extra={<Link to="/agent/leads" style={{ fontSize: 13 }}>View all →</Link>}
            style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
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
          <Card
            title={<span style={{ fontWeight: 700 }}>Your Profile</span>}
            style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{
                  width: 68, height: 68, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                  color: '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 26, fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(59,130,246,0.35)',
                }}>
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
                <div style={{ fontWeight: 700, marginTop: 10, fontSize: 15 }}>{user.name || user.email}</div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{user.email}</Typography.Text>
              </div>
              <Card size="small" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 1, marginBottom: 6, fontWeight: 600 }}>
                  Referral Code
                </div>
                <Typography.Text
                  copyable={{ icon: <CopyOutlined />, text: user.referralCode }}
                  style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 800, color: '#1e40af' }}
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
