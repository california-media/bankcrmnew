import { useEffect, useState } from 'react';
import { Card, Col, Row, Typography, Statistic, Skeleton, Space } from 'antd';
import {
  TeamOutlined,
  IdcardOutlined,
  BankOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

function AdminDashboard() {
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    api.get('/admin/overview').then((res) => setOverview(res.data));
  }, []);

  const cards = [
    { key: 'totalLeads', title: 'Total Leads', value: overview?.totalLeads, icon: <AuditOutlined style={{ color: '#3b82f6' }} />, link: '/admin/leads' },
    { key: 'approvedLeads', title: 'Approved', value: overview?.approvedLeads, icon: <CheckCircleOutlined style={{ color: '#16a34a' }} /> },
    { key: 'pendingLeads', title: 'Pending Review', value: overview?.pendingLeads, icon: <ClockCircleOutlined style={{ color: '#f59e0b' }} /> },
    { key: 'paidCommission', title: 'Commission Paid', value: aed(overview?.paidCommission), icon: <DollarOutlined style={{ color: '#16a34a' }} />, highlight: true },
    { key: 'payableCommission', title: 'Commission Payable', value: aed(overview?.payableCommission), icon: <RiseOutlined style={{ color: '#d4a847' }} /> },
    { key: 'agents', title: 'Agents', value: overview?.agents, icon: <IdcardOutlined style={{ color: '#3b82f6' }} />, link: '/admin/agents' },
    { key: 'agencies', title: 'Agencies', value: overview?.agencies, icon: <TeamOutlined style={{ color: '#16a34a' }} />, link: '/admin/agencies' },
    { key: 'banks', title: 'Banks', value: overview?.banks, icon: <BankOutlined style={{ color: '#0ea5e9' }} />, link: '/admin/banks' },
  ];

  return (
    <>
      <Typography.Title level={3} style={{ margin: 0 }}>Admin Overview</Typography.Title>
      <Typography.Text type="secondary">
        Counts across the system. Drill in via the sidebar for full lists.
      </Typography.Text>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {cards.map((c) => {
          const card = (
            <Card
              hoverable={!!c.link}
              style={c.highlight ? { background: '#fdf6e3', borderColor: '#d4a847' } : undefined}
            >
              {!overview ? <Skeleton active paragraph={{ rows: 1 }} /> : (
                <Statistic
                  title={<Space>{c.icon}<span style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>{c.title}</span></Space>}
                  value={c.value}
                  valueStyle={{ fontSize: 24, fontWeight: 700 }}
                />
              )}
            </Card>
          );
          return (
            <Col xs={24} sm={12} lg={6} key={c.key}>
              {c.link ? <Link to={c.link}>{card}</Link> : card}
            </Col>
          );
        })}
      </Row>
    </>
  );
}

export default AdminDashboard;
