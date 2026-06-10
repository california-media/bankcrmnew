import { useEffect, useState } from 'react';
import { Card, Col, Row, Skeleton } from 'antd';
import {
  AuditOutlined, ClockCircleOutlined, DollarOutlined, RiseOutlined,
  ArrowRightOutlined, ArrowUpOutlined, ArrowDownOutlined,
  CheckCircleOutlined, UserOutlined, ApartmentOutlined, BankOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

/* ── Trend badge ──────────────────────────────────────────────────── */
const TrendBadge = ({ delta }) => {
  if (delta === null || delta === undefined) return null;
  const up = delta >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 12, fontWeight: 500,
      color: up ? '#16a34a' : '#dc2626',
    }}>
      {up ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : <ArrowDownOutlined style={{ fontSize: 10 }} />}
      {up ? '+' : ''}{delta}% vs last month
    </span>
  );
};

/* ── Stat card ───────────────────────────────────────────────────── */
const StatCard = ({ title, value, icon, iconColor = '#4f46e5', trend, loading, link }) => {
  const inner = loading ? (
    <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0', height: '100%' }}
      styles={{ body: { padding: '22px 24px' } }}>
      <Skeleton active paragraph={{ rows: 2 }} />
    </Card>
  ) : (
    <Card
      style={{
        borderRadius: 16,
        border: '1px solid #edf0f7',
        borderTop: `3px solid ${iconColor}`,
        background: `linear-gradient(170deg, ${iconColor}12 0%, #ffffff 45%, #f8faff 100%)`,
        boxShadow: '0 4px 16px rgba(15,23,42,0.08)',
        height: '100%',
        cursor: link ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s, transform 0.2s',
      }}
      styles={{ body: { padding: '20px 22px 18px' } }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = `0 8px 24px ${iconColor}28`;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(15,23,42,0.07)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.9, color: '#94a3b8' }}>
          {title}
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${iconColor}12`,
          border: `1px solid ${iconColor}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color: iconColor,
        }}>
          {icon}
        </div>
      </div>
      <div style={{
        fontSize: 28, fontWeight: 600, color: '#1e293b',
        lineHeight: 1, marginBottom: 10,
        fontFamily: 'Inter, sans-serif', letterSpacing: '-0.2px',
      }}>
        {value ?? '—'}
      </div>
      <TrendBadge delta={trend} />
    </Card>
  );
  return link ? <Link to={link} style={{ display: 'block', height: '100%' }}>{inner}</Link> : inner;
};

/* ── Mini stat strip ─────────────────────────────────────────────── */
const MiniStat = ({ label, value, color = '#6366f1', link, icon }) => {
  const inner = (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 16px', background: '#ffffff',
        borderRadius: 14, border: '1px solid #edf0f7',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.15s, transform 0.15s',
        cursor: link ? 'pointer' : 'default',
      }}
      onMouseEnter={link ? (e => {
        e.currentTarget.style.boxShadow = `0 4px 16px ${color}28`;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }) : undefined}
      onMouseLeave={link ? (e => {
        e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.05)';
        e.currentTarget.style.transform = 'translateY(0)';
      }) : undefined}
    >
      {icon && (
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: `${color}15`, border: `1.5px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color, flexShrink: 0,
        }}>
          {icon}
        </div>
      )}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.7, color: '#94a3b8', marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: '#1e293b', lineHeight: 1, fontFamily: 'Inter, sans-serif' }}>
          {value ?? '—'}
        </div>
      </div>
    </div>
  );
  return link
    ? <Link to={link} style={{ flex: 1, display: 'block', textDecoration: 'none' }}>{inner}</Link>
    : <div style={{ flex: 1 }}>{inner}</div>;
};

/* ── Pipeline stages ─────────────────────────────────────────────── */
const STAGE_MAP = [
  { status: 'submitted',    label: 'NEW',        bg: '#e0f7fa', border: '#a5f3fc', dot: '#06b6d4', text: '#0e7490' },
  { status: 'under_review', label: 'PROCESSING', bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6', text: '#1d4ed8' },
  { status: 'approved',     label: 'APPROVED',   bg: '#f3e8ff', border: '#d8b4fe', dot: '#a855f7', text: '#7e22ce' },
  { status: 'cpvDone',      label: 'CPV DONE',   bg: '#fef9c3', border: '#fde047', dot: '#eab308', text: '#a16207' },
  { status: 'activateDone', label: 'ACTIVATED',  bg: '#e0f2fe', border: '#7dd3fc', dot: '#0ea5e9', text: '#0369a1' },
  { status: 'disbursed',    label: 'PAID',       bg: '#dcfce7', border: '#86efac', dot: '#22c55e', text: '#15803d' },
];

/* ── Lead Pipeline card ──────────────────────────────────────────── */
function LeadPipeline({ pipeline, totalLeads }) {
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
      style={{ height: '100%', borderRadius: 16, border: '1px solid #e8edf5', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
      styles={{ body: { padding: '24px 28px' } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 18, color: '#374151', marginBottom: 4, fontFamily: 'Inter, sans-serif' }}>
            Lead pipeline
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 400 }}>
            New → Processing → Approved → Activated → Paid
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {totalLeads !== undefined && (
            <div style={{
              padding: '4px 12px', borderRadius: 999,
              background: '#f0f0ff', border: '1px solid #c7d2fe',
              fontSize: 12, fontWeight: 600, color: '#4f46e5',
            }}>
              {totalLeads} total
            </div>
          )}
          <Link
            to="/admin/leads"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontWeight: 600, fontSize: 14, color: '#374151',
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            View all <ArrowRightOutlined style={{ fontSize: 13 }} />
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {displayStages.map((stage) => {
          const pct = Math.max(stage.count === 0 ? 1.5 : (stage.count / max) * 100, 1.5);
          const countInside = stage.count > 0 && pct >= 14;

          return (
            <div key={stage.status} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 124, padding: '6px 12px', borderRadius: 999, flexShrink: 0,
                background: stage.bg, border: `1.5px solid ${stage.border}`,
                display: 'flex', alignItems: 'center', gap: 7,
                fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                color: stage.text, whiteSpace: 'nowrap',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: stage.dot, flexShrink: 0 }} />
                {stage.label}
              </div>

              <div style={{ flex: 1, position: 'relative' }}>
                <div style={{ height: 32, background: '#eef0f6', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%', borderRadius: 999,
                    background: 'linear-gradient(90deg, #8b5cf6 0%, #6366f1 40%, #60a5fa 100%)',
                    transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    paddingRight: stage.count > 0 ? 14 : 0,
                  }}>
                    {stage.count > 0 && (
                      <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{stage.count}</span>
                    )}
                  </div>
                </div>
                {stage.count === 0 && (
                  <div style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 13, fontWeight: 600, color: '#94a3b8',
                  }}>
                    0
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Product Payouts + Top Agents ────────────────────────────────── */
const PRODUCT_COLORS = { credit_card: '#4f46e5', loan: '#0ea5e9' };

function ProductPayouts({ payouts, topAgents, loading }) {
  if (loading) {
    return (
      <Card style={{ height: '100%', borderRadius: 16, border: '1px solid #e2e8f0' }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  const allProducts = [
    { type: 'credit_card', label: 'Credit Card' },
    { type: 'loan',        label: 'Loan' },
  ];
  const byType = Object.fromEntries((payouts || []).map((p) => [p.type, p]));
  const maxPaid = Math.max(1, ...allProducts.map((p) => byType[p.type]?.paid || 0));

  return (
    <Card
      style={{ height: '100%', borderRadius: 16, border: '1px solid #e8edf5', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
      styles={{ body: { padding: '24px' } }}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 16, color: '#374151', marginBottom: 3, fontFamily: 'Inter, sans-serif' }}>
          Product payouts
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>Paid commissions by product</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {allProducts.map((p) => {
          const paid = byType[p.type]?.paid || 0;
          const pct = (paid / maxPaid) * 100;
          const color = PRODUCT_COLORS[p.type] || '#4f46e5';
          return (
            <div key={p.type} style={{
              padding: '11px 14px', borderRadius: 12,
              background: '#f8fafc', border: '1px solid #f1f5f9',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{p.label}</span>
                </div>
                <span style={{ fontWeight: 700, fontSize: 13, color: paid > 0 ? '#0f172a' : '#94a3b8' }}>
                  {aed(paid)}
                </span>
              </div>
              <div style={{ height: 5, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`, height: '100%',
                  background: `linear-gradient(90deg, ${color}, ${color}99)`,
                  borderRadius: 999, transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ height: 1, background: '#e8edf5', margin: '18px 0 14px' }} />

      <div style={{ fontWeight: 600, fontSize: 15, color: '#374151', marginBottom: 3, fontFamily: 'Inter, sans-serif' }}>
        Top agents
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400, marginBottom: 14 }}>By paid commission</div>
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

const RANK_COLORS = ['#f59e0b', '#64748b', '#c2855e'];

function TopAgentsList({ agents }) {
  if (!agents) return <Skeleton active paragraph={{ rows: 3 }} avatar={false} />;
  if (agents.length === 0) return <div style={{ fontSize: 13, color: '#94a3b8' }}>No paid commissions yet.</div>;
  const initials = (name) => (name || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {agents.map((agent, i) => (
        <div key={agent._id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '7px 8px', borderRadius: 10,
          background: i === 0 ? '#fffbeb' : 'transparent',
          border: `1px solid ${i === 0 ? '#fef3c7' : 'transparent'}`,
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: i < 3 ? `${RANK_COLORS[i]}20` : '#f1f5f9',
            border: `1.5px solid ${i < 3 ? RANK_COLORS[i] : '#e2e8f0'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700, color: i < 3 ? RANK_COLORS[i] : '#64748b', flexShrink: 0,
          }}>
            {i + 1}
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {initials(agent.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {agent.name || 'Unknown'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {agent.email}
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a', flexShrink: 0 }}>
            {aed(agent.paid)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Recent Activity ─────────────────────────────────────────────── */
const ACTIVITY_STATUS = {
  draft:        { label: 'DRAFT',      dot: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', text: '#64748b' },
  submitted:    { label: 'NEW',        dot: '#06b6d4', bg: '#ecfeff', border: '#a5f3fc', text: '#0e7490' },
  under_review: { label: 'PROCESSING', dot: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  assigned:     { label: 'ASSIGNED',   dot: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9' },
  approved:     { label: 'APPROVED',   dot: '#a855f7', bg: '#faf5ff', border: '#e9d5ff', text: '#7e22ce' },
  rejected:     { label: 'REJECTED',   dot: '#ef4444', bg: '#fef2f2', border: '#fecaca', text: '#dc2626' },
  disbursed:    { label: 'PAID',       dot: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
};

const AVATAR_BG    = ['#e0e7ff', '#ddd6fe', '#e0f2fe', '#dcfce7', '#fce7f3', '#fef3c7'];
const AVATAR_COLOR = ['#4338ca', '#7c3aed', '#0369a1', '#15803d', '#9d174d', '#b45309'];
const nameInitials = (name) => (name || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

function RecentActivity({ leads, loading }) {
  if (loading) {
    return (
      <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0', marginTop: 20 }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  return (
    <Card
      style={{ borderRadius: 16, border: '1px solid #e8edf5', boxShadow: '0 1px 6px rgba(0,0,0,0.04)', marginTop: 20 }}
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px' }}>
        <div style={{ fontWeight: 600, fontSize: 16, color: '#374151', fontFamily: 'Inter, sans-serif' }}>Recent activity</div>
        <Link
          to="/admin/leads"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontWeight: 500, fontSize: 13, color: '#374151',
            padding: '6px 12px', borderRadius: 8,
            border: '1px solid #e2e8f0', background: '#f8fafc',
            textDecoration: 'none',
          }}
        >
          All leads <ArrowRightOutlined style={{ fontSize: 11 }} />
        </Link>
      </div>

      <div style={{ borderTop: '1px solid #f1f5f9' }}>
        {(!leads || leads.length === 0) && (
          <div style={{ padding: '32px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            No recent leads
          </div>
        )}
        {(leads || []).map((lead, i) => {
          const st = ACTIVITY_STATUS[lead.status] || ACTIVITY_STATUS.submitted;
          const avatarIdx = i % AVATAR_BG.length;
          const productLabel = lead.productType === 'credit_card' ? 'Credit Card' : 'Loan';
          const bankName = lead.bank?.name || '—';
          const amount = lead.loanAmount
            ? `AED ${Number(lead.loanAmount).toLocaleString()}`
            : lead.commission
              ? `AED ${Number(lead.commission).toLocaleString()}`
              : '';

          return (
            <Link key={lead._id} to={`/admin/leads/${lead._id}`} style={{ display: 'block', textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 24px',
                  borderBottom: i < (leads.length - 1) ? '1px solid #f1f5f9' : 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: AVATAR_BG[avatarIdx], color: AVATAR_COLOR[avatarIdx],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 600,
                }}>
                  {nameInitials(lead.customerName)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, color: '#0f172a', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lead.customerName}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {productLabel} · {bankName}{amount ? ` · ${amount}` : ''}
                  </div>
                </div>

                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 999, flexShrink: 0,
                  background: st.bg, border: `1.5px solid ${st.border}`,
                  fontSize: 11, fontWeight: 600, letterSpacing: 0.3, color: st.text,
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                  {st.label}
                </div>

                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400, whiteSpace: 'nowrap', marginLeft: 8, flexShrink: 0 }}>
                  {dayjs(lead.updatedAt || lead.createdAt).fromNow()}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Main Dashboard ──────────────────────────────────────────────── */
function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [recentLeads, setRecentLeads] = useState(null);

  useEffect(() => {
    api.get('/admin/overview').then((res) => setOverview(res.data));
    api.get('/leads').then((res) => {
      const sorted = [...(res.data || [])].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      setRecentLeads(sorted.slice(0, 8));
    });
  }, []);

  const primaryCards = [
    {
      key: 'totalLeads',
      title: 'Total Leads',
      value: overview?.totalLeads,
      icon: <AuditOutlined />,
      iconColor: '#4f46e5',
      trend: overview?.trend?.totalLeads,
      link: '/admin/leads',
    },
    {
      key: 'activeLeads',
      title: 'In Pipeline',
      value: overview?.activeLeads,
      icon: <RiseOutlined />,
      iconColor: '#0ea5e9',
      trend: overview?.trend?.activeLeads,
    },
    {
      key: 'paidCommission',
      title: 'Commission Paid',
      value: aed(overview?.paidCommission),
      icon: <DollarOutlined />,
      iconColor: '#16a34a',
      trend: overview?.trend?.paidCommission,
    },
    {
      key: 'payableCommission',
      title: 'Pending Payout',
      value: aed(overview?.payableCommission),
      icon: <ClockCircleOutlined />,
      iconColor: '#f97316',
      trend: null,
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

      {/* Secondary Stats Strip */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <MiniStat label="Approved" value={overview?.approvedLeads} color="#22c55e" icon={<CheckCircleOutlined />} />
        <MiniStat label="Agents"   value={overview?.agents}        color="#6366f1" icon={<UserOutlined />}        link="/admin/agents" />
        <MiniStat label="Agencies" value={overview?.agencies}      color="#0ea5e9" icon={<ApartmentOutlined />}   link="/admin/agencies" />
        <MiniStat label="Banks"    value={overview?.banks}         color="#f97316" icon={<BankOutlined />}        link="/admin/banks" />
      </div>

      {/* Pipeline + Payouts */}
      <Row gutter={[14, 14]}>
        <Col xs={24} lg={15}>
          <LeadPipeline
            totalLeads={overview?.totalLeads}
            pipeline={overview ? [
              ...(overview.pipeline || []),
              { status: 'cpvDone',      count: overview.cpvDoneLeads     || 0 },
              { status: 'activateDone', count: overview.activateDoneLeads || 0 },
            ] : null}
          />
        </Col>
        <Col xs={24} lg={9}>
          <ProductPayouts
            payouts={overview?.productPayouts}
            topAgents={overview?.topAgents}
            loading={!overview}
          />
        </Col>
      </Row>

      {/* Recent Activity */}
      <RecentActivity leads={recentLeads} loading={recentLeads === null} />
    </>
  );
}

export default AdminDashboard;
