import { useEffect, useState } from 'react';
import { Avatar, Card, Col, Row, Skeleton, Typography } from 'antd';
import {
  TeamOutlined,
  IdcardOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  RiseOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const StatCard = ({ title, value, icon, gradient, link, loading }) => {
  const card = loading ? (
    <Card styles={{ body: { padding: '22px 24px' } }} style={{ borderRadius: 16, border: '1px solid #e2e8f0', height: '100%' }}>
      <Skeleton active paragraph={{ rows: 1 }} />
    </Card>
  ) : (
    <Card
      hoverable={!!link}
      styles={{ body: { padding: '24px', position: 'relative', overflow: 'hidden' } }}
      style={{ borderRadius: 16, border: 'none', background: gradient, boxShadow: '0 6px 24px rgba(0,0,0,0.13)', height: '100%', overflow: 'hidden', cursor: link ? 'pointer' : 'default' }}
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
  return link ? <Link to={link} style={{ display: 'block', height: '100%' }}>{card}</Link> : card;
};

const STAGE_COLORS = {
  draft:        { bg: '#f1f5f9', color: '#64748b', dot: '#94a3b8' },
  submitted:    { bg: '#eff6ff', color: '#2563eb', dot: '#3b82f6' },
  under_review: { bg: '#fefce8', color: '#ca8a04', dot: '#eab308' },
  assigned:     { bg: '#f0fdf4', color: '#16a34a', dot: '#22c55e' },
  approved:     { bg: '#f0fdf4', color: '#15803d', dot: '#16a34a' },
  disbursed:    { bg: '#f0f9ff', color: '#0369a1', dot: '#0ea5e9' },
  rejected:     { bg: '#fff1f2', color: '#be123c', dot: '#f43f5e' },
};

function LeadPipeline({ pipeline }) {
  const max = Math.max(...((pipeline || []).map((s) => s.count)), 1);

  if (!pipeline) {
    return (
      <Card style={{ height: '100%', borderRadius: 16, border: '1px solid #e2e8f0' }}>
        <Skeleton active paragraph={{ rows: 7 }} />
      </Card>
    );
  }

  return (
    <Card
      style={{ height: '100%', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      styles={{ body: { padding: '24px 28px' } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Typography.Title level={5} style={{ margin: 0, fontWeight: 700 }}>Lead Pipeline</Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Draft → Submitted → Under Review → Assigned → Approved → Disbursed
          </Typography.Text>
        </div>
        <Link to="/admin/leads" style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 14, color: '#0f172a', whiteSpace: 'nowrap' }}>
          View all <ArrowRightOutlined />
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(pipeline || []).map((stage) => {
          const c = STAGE_COLORS[stage.status] || STAGE_COLORS.draft;
          const pct = (stage.count / max) * 100;
          // bar is "wide enough" to show count inside if > 20%
          const countInside = pct > 20;
          // minimum visual bar width: 18px pill cap for 0, proportional otherwise
          const barStyle = stage.count === 0
            ? { width: 18, minWidth: 18 }
            : { width: `${pct}%`, minWidth: 48 };

          return (
            <div key={stage.status} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {/* pill */}
              <div style={{
                width: 128, padding: '5px 12px', borderRadius: 999, flexShrink: 0,
                background: c.bg, border: `1px solid ${c.dot}40`,
                display: 'flex', alignItems: 'center', gap: 7,
                fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9,
                color: c.color,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                {stage.label}
              </div>

              {/* track */}
              <div style={{ flex: 1, height: 38, background: '#f1f5f9', borderRadius: 999, position: 'relative' }}>
                {/* filled bar */}
                <div style={{
                  ...barStyle,
                  height: '100%',
                  borderRadius: 999,
                  background: 'linear-gradient(90deg, #6366f1 0%, #3b82f6 100%)',
                  transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  paddingRight: countInside ? 14 : 0,
                }}>
                  {countInside && (
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{stage.count}</span>
                  )}
                </div>

                {/* count outside (right of track) when bar too short */}
                {!countInside && (
                  <span style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 13, fontWeight: 700, color: '#374151',
                  }}>
                    {stage.count}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
  'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
  'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
  'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
];

function TopAgents({ agents }) {
  if (!agents) {
    return (
      <Card style={{ height: '100%', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Skeleton active avatar paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  const initials = (name) => (name || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Card
      style={{ height: '100%', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      styles={{ body: { padding: '24px 20px' } }}
    >
      <div style={{ marginBottom: 20 }}>
        <Typography.Title level={5} style={{ margin: 0, fontWeight: 700 }}>Top Agents</Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>By paid commission</Typography.Text>
      </div>

      {agents.length === 0 && (
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>No paid commissions yet.</Typography.Text>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {agents.map((agent, i) => (
          <div key={agent._id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* rank */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '1.5px solid #e2e8f0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#64748b', flexShrink: 0,
            }}>
              {i + 1}
            </div>
            {/* avatar */}
            <Avatar
              size={40}
              style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length], fontWeight: 700, fontSize: 14, flexShrink: 0 }}
            >
              {initials(agent.name)}
            </Avatar>
            {/* name + email */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {agent.name || 'Unknown'}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {agent.email}
              </div>
            </div>
            {/* amount */}
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', flexShrink: 0 }}>
              {aed(agent.paid)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AdminDashboard() {
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    api.get('/admin/overview').then((res) => setOverview(res.data));
  }, []);

  const cards = [
    { key: 'totalLeads',       title: 'Total Leads',        value: overview?.totalLeads,             icon: <AuditOutlined />,       gradient: 'linear-gradient(135deg, #1d4ed8 0%, #60a5fa 100%)', link: '/admin/leads' },
    { key: 'approvedLeads',    title: 'Approved',           value: overview?.approvedLeads,          icon: <CheckCircleOutlined />, gradient: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)' },
    { key: 'pendingLeads',     title: 'Pending Review',     value: overview?.pendingLeads,           icon: <ClockCircleOutlined />, gradient: 'linear-gradient(135deg, #b45309 0%, #fbbf24 100%)' },
    { key: 'paidCommission',   title: 'Commission Paid',    value: aed(overview?.paidCommission),    icon: <DollarOutlined />,      gradient: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)' },
    { key: 'payableCommission',title: 'Commission Payable', value: aed(overview?.payableCommission), icon: <RiseOutlined />,        gradient: 'linear-gradient(135deg, #0369a1 0%, #38bdf8 100%)' },
    { key: 'agents',           title: 'Agents',             value: overview?.agents,                 icon: <IdcardOutlined />,      gradient: 'linear-gradient(135deg, #6d28d9 0%, #a78bfa 100%)', link: '/admin/agents' },
    { key: 'agencies',         title: 'Agencies',           value: overview?.agencies,               icon: <TeamOutlined />,        gradient: 'linear-gradient(135deg, #0e7490 0%, #22d3ee 100%)', link: '/admin/agencies' },
  ];

  return (
    <>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>Admin Overview</div>
        <div style={{ fontSize: 13, color: '#94a3b8' }}>Network-wide performance across all agents and agencies.</div>
      </div>

      {/* Stat Cards — row 1: 4 cards */}
      <Row gutter={[14, 14]}>
        {cards.slice(0, 4).map((c) => (
          <Col xs={24} sm={12} lg={6} key={c.key}>
            <StatCard {...c} loading={!overview} />
          </Col>
        ))}
      </Row>

      {/* Stat Cards — row 2: 3 cards, each wider */}
      <Row gutter={[14, 14]} style={{ marginTop: 14 }}>
        {cards.slice(4).map((c) => (
          <Col xs={24} sm={8} lg={8} key={c.key}>
            <StatCard {...c} loading={!overview} />
          </Col>
        ))}
      </Row>

      {/* Lead Pipeline + Top Agents */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={16}>
          <LeadPipeline pipeline={overview?.pipeline} />
        </Col>
        <Col xs={24} lg={8}>
          <TopAgents agents={overview?.topAgents} />
        </Col>
      </Row>
    </>
  );
}

export default AdminDashboard;
