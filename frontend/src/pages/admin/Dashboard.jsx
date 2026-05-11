import { useEffect, useState } from 'react';
import { Card, Col, Row, Typography, Skeleton } from 'antd';
import {
  TeamOutlined,
  IdcardOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const StatCard = ({ title, value, icon, iconColor, iconBg, link, loading }) => {
  const card = (
    <Card
      hoverable={!!link}
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
  return link ? <Link to={link} style={{ display: 'block', height: '100%' }}>{card}</Link> : card;
};

function AdminDashboard() {
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    api.get('/admin/overview').then((res) => setOverview(res.data));
  }, []);

  const cards = [
    { key: 'totalLeads', title: 'Total Leads', value: overview?.totalLeads, icon: <AuditOutlined />, iconColor: '#3b82f6', iconBg: '#eff6ff', link: '/admin/leads' },
    { key: 'approvedLeads', title: 'Approved', value: overview?.approvedLeads, icon: <CheckCircleOutlined />, iconColor: '#16a34a', iconBg: '#f0fdf4' },
    { key: 'pendingLeads', title: 'Pending Review', value: overview?.pendingLeads, icon: <ClockCircleOutlined />, iconColor: '#d97706', iconBg: '#fffbeb' },
    { key: 'paidCommission', title: 'Commission Paid', value: aed(overview?.paidCommission), icon: <DollarOutlined />, iconColor: '#16a34a', iconBg: '#f0fdf4' },
    { key: 'payableCommission', title: 'Commission Payable', value: aed(overview?.payableCommission), icon: <RiseOutlined />, iconColor: '#d4a847', iconBg: '#fdf6e3' },
    { key: 'agents', title: 'Agents', value: overview?.agents, icon: <IdcardOutlined />, iconColor: '#7c3aed', iconBg: '#f5f3ff', link: '/admin/agents' },
    { key: 'agencies', title: 'Agencies', value: overview?.agencies, icon: <TeamOutlined />, iconColor: '#0e7490', iconBg: '#ecfeff', link: '/admin/agencies' },
  ];

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <Typography.Title level={3} style={{ margin: 0, color: '#0f172a' }}>Admin Overview</Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          System-wide summary. Drill in via the sidebar for full lists.
        </Typography.Text>
      </div>

      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col xs={24} sm={12} lg={6} key={c.key}>
            <StatCard {...c} loading={!overview} />
          </Col>
        ))}
      </Row>
    </>
  );
}

export default AdminDashboard;
