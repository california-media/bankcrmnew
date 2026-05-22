import { useEffect, useState } from 'react';
import { Card, Col, Row, Skeleton, Divider } from 'antd';
import {
  AuditOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  RiseOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

/* ── Light stat card (reference style) ────────────────────────── */
const StatCard = ({ title, value, icon, iconColor = '#4f46e5', loading, link }) => {
  const inner = loading ? (
    <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0', height: '100%' }}
      styles={{ body: { padding: '22px 24px' } }}>
      <Skeleton active paragraph={{ rows: 2 }} />
    </Card>
  ) : (
    <Card
      style={{
        borderRadius: 16,
        border: '1px solid #e2e8f0',
        background: 'linear-gradient(135deg, #ffffff 55%, #f0f4ff 100%)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        height: '100%',
        cursor: link ? 'pointer' : 'default',
      }}
      styles={{ body: { padding: '22px 24px' } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.1, color: '#94a3b8' }}>
          {title}
        </div>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: `${iconColor}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, color: iconColor,
        }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
        {value ?? '—'}
      </div>
    </Card>
  );
  return link ? <Link to={link} style={{ display: 'block', height: '100%' }}>{inner}</Link> : inner;
};

/* ── Mini secondary stat ───────────────────────────────────────── */
const MiniStat = ({ label, value, color = '#6366f1', link }) => {
  const inner = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 18px',
      background: '#fff',
      borderRadius: 12,
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      borderLeft: `4px solid ${color}`,
      cursor: link ? 'pointer' : 'default',
      flex: 1,
    }}>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, color: '#94a3b8', marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
          {value ?? '—'}
        </div>
      </div>
    </div>
  );
  return link ? <Link to={link} style={{ flex: 1, display: 'block' }}>{inner}</Link> : <div style={{ flex: 1 }}>{inner}</div>;
};

/* ── Pipeline stage map (5 display stages) ─────────────────────── */
const STAGE_MAP = [
  { status: 'submitted',    label: 'NEW',       bg: '#e0f7fa', border: '#a5f3fc', dot: '#06b6d4', text: '#0e7490' },
  { status: 'approved',     label: 'APPROVED',  bg: '#f3e8ff', border: '#d8b4fe', dot: '#a855f7', text: '#7e22ce' },
  { status: 'cpvDone',      label: 'CPV DONE',  bg: '#fef9c3', border: '#fde047', dot: '#eab308', text: '#a16207' },
  { status: 'activateDone', label: 'ACTIVATED', bg: '#e0f2fe', border: '#7dd3fc', dot: '#0ea5e9', text: '#0369a1' },
  { status: 'disbursed',    label: 'PAID',      bg: '#dcfce7', border: '#86efac', dot: '#22c55e', text: '#15803d' },
];

/* ── Lead Pipeline ─────────────────────────────────────────────── */
function LeadPipeline({ pipeline }) {
  if (!pipeline) {
    return (
      <Card style={{ height: '100%', borderRadius: 16, border: '1px solid #e2e8f0' }}>
        <Skeleton active paragraph={{ rows: 7 }} />
      </Card>
    );
  }

  const displayStages = STAGE_MAP.map((s) => {
    const found = pipeline.find((p) => p.status === s.status);
    return { ...s, count: found?.count || 0 };
  });
  const max = Math.max(1, ...displayStages.map((s) => s.count));

  return (
    <Card
      style={{ height: '100%', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      styles={{ body: { padding: '24px 28px' } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: 3 }}>Lead Pipeline</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            New → Approved → CPV Done → Activated → Paid
          </div>
        </div>
        <Link to="/admin/leads" style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap' }}>
          View all <ArrowRightOutlined />
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {displayStages.map((stage) => {
          const pct = Math.max(stage.count === 0 ? 2 : (stage.count / max) * 100, 2);
          const countInside = pct > 16;

          return (
            <div key={stage.status} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 100, padding: '5px 10px', borderRadius: 999, flexShrink: 0,
                background: stage.bg, border: `1.5px solid ${stage.border}`,
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7,
                color: stage.text,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: stage.dot, flexShrink: 0 }} />
                {stage.label}
              </div>

              <div style={{ flex: 1, height: 22, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: 'linear-gradient(90deg, #7c3aed 0%, #4f46e5 45%, #3b82f6 100%)',
                  transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  paddingRight: countInside ? 12 : 0,
                }}>
                  {countInside && (
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{stage.count}</span>
                  )}
                </div>
              </div>

              <div style={{ width: 24, textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#334155', flexShrink: 0 }}>
                {!countInside ? stage.count : ''}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Product Payouts ───────────────────────────────────────────── */
const PRODUCT_ICONS = {
  credit_card: '💳',
  loan: '🏦',
};

function ProductPayouts({ payouts, topAgents, loading }) {
  if (loading) {
    return (
      <Card style={{ height: '100%', borderRadius: 16, border: '1px solid #e2e8f0' }}>
        <Skeleton active paragraph={{ rows: 5 }} />
      </Card>
    );
  }

  const allProducts = [
    { type: 'credit_card', label: 'Credit Card' },
    { type: 'loan', label: 'Loan' },
  ];
  const byType = Object.fromEntries((payouts || []).map((p) => [p.type, p]));

  return (
    <Card
      style={{ height: '100%', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      styles={{ body: { padding: '24px' } }}
    >
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: 3 }}>Product Payouts</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Paid commissions by product</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {allProducts.map((p, i) => {
          const data = byType[p.type];
          const paid = data?.paid || 0;
          const count = data?.count || 0;
          return (
            <div key={p.type}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: p.type === 'credit_card' ? '#eff6ff' : '#f0fdf4',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18,
                  }}>
                    {PRODUCT_ICONS[p.type]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{count} paid lead{count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: paid > 0 ? '#15803d' : '#94a3b8' }}>
                  {aed(paid)}
                </div>
              </div>
              {i < allProducts.length - 1 && <Divider style={{ margin: 0, borderColor: '#f1f5f9' }} />}
            </div>
          );
        })}
      </div>

      {/* Top Agents section folded into this card */}
      <Divider style={{ margin: '16px 0 14px', borderColor: '#e2e8f0' }} />
      <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>Top Agents</div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>By paid commission</div>
      <TopAgentsList agents={topAgents} />
    </Card>
  );
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
  'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
  'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
  'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
];

function TopAgentsList({ agents }) {
  if (!agents) return <Skeleton active paragraph={{ rows: 3 }} avatar={false} />;
  if (agents.length === 0) return <div style={{ fontSize: 13, color: '#94a3b8' }}>No paid commissions yet.</div>;

  const initials = (name) => (name || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {agents.map((agent, i) => (
        <div key={agent._id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            border: '1.5px solid #e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#64748b', flexShrink: 0,
          }}>
            {i + 1}
          </div>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {initials(agent.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {agent.name || 'Unknown'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {agent.email}
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', flexShrink: 0 }}>
            {aed(agent.paid)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main Dashboard ────────────────────────────────────────────── */
function AdminDashboard() {
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    api.get('/admin/overview').then((res) => setOverview(res.data));
  }, []);

  const primaryCards = [
    {
      key: 'totalLeads',
      title: 'Total Leads',
      value: overview?.totalLeads,
      icon: <AuditOutlined />,
      iconColor: '#4f46e5',
      link: '/admin/leads',
    },
    {
      key: 'activeLeads',
      title: 'In Pipeline',
      value: overview?.activeLeads,
      icon: <RiseOutlined />,
      iconColor: '#0ea5e9',
    },
    {
      key: 'paidCommission',
      title: 'Commission Paid',
      value: aed(overview?.paidCommission),
      icon: <DollarOutlined />,
      iconColor: '#16a34a',
    },
    {
      key: 'payableCommission',
      title: 'Pending Payout',
      value: aed(overview?.payableCommission),
      icon: <ClockCircleOutlined />,
      iconColor: '#f97316',
    },
  ];

  return (
    <>
      {/* Primary Stat Cards */}
      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        {primaryCards.map((c) => (
          <Col xs={24} sm={12} lg={6} key={c.key}>
            <StatCard {...c} loading={!overview} />
          </Col>
        ))}
      </Row>

      {/* Secondary Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <MiniStat label="Approved Leads" value={overview?.approvedLeads} color="#22c55e" />
        <MiniStat label="Agents" value={overview?.agents} color="#6366f1" link="/admin/agents" />
        <MiniStat label="Agencies" value={overview?.agencies} color="#0ea5e9" link="/admin/agencies" />
        <MiniStat label="Banks" value={overview?.banks} color="#f97316" link="/admin/banks" />
      </div>

      {/* Lead Pipeline + Product Payouts */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15}>
          <LeadPipeline pipeline={overview ? [
            ...(overview.pipeline || []),
            { status: 'cpvDone',      label: 'CPV Done',  count: overview.cpvDoneLeads || 0 },
            { status: 'activateDone', label: 'Activated', count: overview.activateDoneLeads || 0 },
          ] : null} />
        </Col>
        <Col xs={24} lg={9}>
          <ProductPayouts payouts={overview?.productPayouts} topAgents={overview?.topAgents} loading={!overview} />
        </Col>
      </Row>
    </>
  );
}

export default AdminDashboard;
