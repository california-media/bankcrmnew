import { useEffect, useState } from 'react';
import { Card, Col, Row, Typography, Skeleton, Button } from 'antd';
import { AuditOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, DollarOutlined, RiseOutlined, BankOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const avatarBg = (name) => {
  const palette = ['#6366f1','#ec4899','#14b8a6','#f59e0b','#8b5cf6','#06b6d4','#10b981','#f43f5e'];
  let h = 0; for (const c of (name || '')) h = h * 31 + c.charCodeAt(0);
  return palette[Math.abs(h) % palette.length];
};
const initials = (name) => (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const PIPELINE_STAGES = [
  { key: 'submitted',    label: 'NEW',       bg: '#e0f7fa', border: '#a5f3fc', dot: '#06b6d4', text: '#0e7490' },
  { key: 'approved',     label: 'APPROVED',  bg: '#f3e8ff', border: '#d8b4fe', dot: '#a855f7', text: '#7e22ce' },
  { key: 'cpvDone',      label: 'CPV DONE',  bg: '#fef9c3', border: '#fde047', dot: '#eab308', text: '#a16207' },
  { key: 'activateDone', label: 'ACTIVATED', bg: '#e0f2fe', border: '#7dd3fc', dot: '#0ea5e9', text: '#0369a1' },
  { key: 'disbursed',    label: 'PAID',      bg: '#dcfce7', border: '#86efac', dot: '#22c55e', text: '#15803d' },
];

const LeadPipeline = ({ pipelineStats }) => {
  const max = Math.max(1, ...PIPELINE_STAGES.map((s) => pipelineStats?.[s.key] ?? 0));
  return (
    <Card
      title={
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Lead Pipeline</div>
          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400, marginTop: 2 }}>
            New → Approved → CPV Done → Activated → Paid
          </div>
        </div>
      }
      extra={<Link to="/agency/leads" style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>View all →</Link>}
      style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
      styles={{ header: { borderBottom: '1px solid #f1f5f9', paddingTop: 16, paddingBottom: 12 }, body: { padding: '16px 24px' } }}
    >
      {PIPELINE_STAGES.map((stage) => {
        const count = pipelineStats?.[stage.key] ?? 0;
        const pct = Math.max(count === 0 ? 2 : (count / max) * 100, 2);
        return (
          <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ width: 100, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, background: stage.bg, border: `1.5px solid ${stage.border}`, fontSize: 10, fontWeight: 700, color: stage.text, whiteSpace: 'nowrap' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: stage.dot, flexShrink: 0 }} />
              {stage.label}
            </div>
            <div style={{ flex: 1, height: 22, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                borderRadius: 999,
                background: 'linear-gradient(90deg, #7c3aed 0%, #4f46e5 45%, #3b82f6 100%)',
                transition: 'width 0.4s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                paddingRight: count > 0 ? 12 : 0,
              }}>
                {count > 0 && pct > 16 && (
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{count}</span>
                )}
              </div>
            </div>
            <div style={{ width: 24, textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#334155', flexShrink: 0 }}>
              {(count === 0 || pct <= 16) ? count : ''}
            </div>
          </div>
        );
      })}
    </Card>
  );
};

const StatCard = ({ title, value, icon, gradient, loading }) =>
  loading ? (
    <Card styles={{ body: { padding: '22px 24px' } }} style={{ borderRadius: 16, border: '1px solid #e2e8f0', height: '100%' }}>
      <Skeleton active paragraph={{ rows: 1 }} />
    </Card>
  ) : (
    <Card
      styles={{ body: { padding: '24px', position: 'relative', overflow: 'hidden' } }}
      style={{ borderRadius: 16, border: 'none', background: gradient, boxShadow: '0 6px 24px rgba(0,0,0,0.13)', height: '100%', overflow: 'hidden' }}
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

const PayoutCard = ({ title, value, sub, icon, gradient, loading }) =>
  loading ? (
    <Card styles={{ body: { padding: '20px 24px' } }} style={{ borderRadius: 16, border: '1px solid #e2e8f0', height: '100%' }}>
      <Skeleton active paragraph={{ rows: 1 }} />
    </Card>
  ) : (
    <Card
      styles={{ body: { padding: '24px', position: 'relative', overflow: 'hidden' } }}
      style={{ borderRadius: 16, border: 'none', background: gradient, boxShadow: '0 6px 24px rgba(0,0,0,0.13)', height: '100%', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', right: -12, top: -12, fontSize: 88, color: 'rgba(255,255,255,0.13)', lineHeight: 1, pointerEvents: 'none' }}>
        {icon}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: 'rgba(255,255,255,0.72)', marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', lineHeight: 1, marginBottom: 8 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.68)' }}>{sub}</div>
    </Card>
  );

function AgencyDashboard() {
  const { user } = useSelector((s) => s.auth);
  const [leads, setLeads] = useState(null);

  useEffect(() => {
    api.get('/leads/agency').then((res) => setLeads(res.data));
  }, []);

  const stats = leads
    ? {
        total: leads.length,
        pending: leads.filter((l) => ['submitted', 'under_review', 'assigned'].includes(l.status)).length,
        approved: leads.filter((l) => ['approved', 'disbursed'].includes(l.status)).length,
        rejected: leads.filter((l) => l.status === 'rejected').length,
        expectedPayout: leads.filter((l) => l.commissionStatus === 'pending').reduce((s, l) => s + (l.grossCommission || 0), 0),
        totalPayout: leads.filter((l) => ['payable', 'paid'].includes(l.commissionStatus)).reduce((s, l) => s + (l.grossCommission || 0), 0),
        paidToAdmin: leads.filter((l) => l.commissionStatus === 'paid').reduce((s, l) => s + (l.grossCommission || 0), 0),
      }
    : null;

  const pipelineStats = leads
    ? {
        submitted: leads.filter((l) => ['submitted', 'under_review', 'assigned'].includes(l.status)).length,
        approved: leads.filter((l) => l.status === 'approved').length,
        cpvDone: leads.filter((l) => l.cpvDone).length,
        activateDone: leads.filter((l) => l.activateDone).length,
        disbursed: leads.filter((l) => l.status === 'disbursed').length,
      }
    : null;

  const productPayouts = leads
    ? (() => {
        const paid = leads.filter((l) => l.commissionStatus === 'paid');
        return [
          {
            type: 'credit_card',
            label: 'Credit Card',
            icon: '💳',
            count: paid.filter((l) => l.productType === 'credit_card').length,
            amount: paid.filter((l) => l.productType === 'credit_card').reduce((s, l) => s + (l.grossCommission || 0), 0),
          },
          {
            type: 'loan',
            label: 'Loan',
            icon: '🏦',
            count: paid.filter((l) => l.productType === 'loan').length,
            amount: paid.filter((l) => l.productType === 'loan').reduce((s, l) => s + (l.grossCommission || 0), 0),
          },
        ];
      })()
    : null;

  const topAgents = leads
    ? (() => {
        const map = {};
        leads.filter((l) => l.commissionStatus === 'paid' && l.agent).forEach((l) => {
          const id = l.agent._id || l.agent;
          if (!map[id]) map[id] = { name: l.agent.name || l.agent.email || '—', email: l.agent.email || '', amount: 0 };
          map[id].amount += l.grossCommission || 0;
        });
        return Object.values(map).sort((a, b) => b.amount - a.amount).slice(0, 5);
      })()
    : null;

  const cards = [
    { key: 'total', title: 'Total Leads', value: stats?.total, icon: <AuditOutlined />, gradient: 'linear-gradient(135deg, #1d4ed8 0%, #60a5fa 100%)' },
    { key: 'pending', title: 'Awaiting Action', value: stats?.pending, icon: <ClockCircleOutlined />, gradient: 'linear-gradient(135deg, #b45309 0%, #fbbf24 100%)' },
    { key: 'approved', title: 'Approved', value: stats?.approved, icon: <CheckCircleOutlined />, gradient: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)' },
    { key: 'rejected', title: 'Rejected', value: stats?.rejected, icon: <CloseCircleOutlined />, gradient: 'linear-gradient(135deg, #b91c1c 0%, #f87171 100%)' },
  ];

  const payoutCards = [
    { key: 'expected', title: 'Expected Payout', value: aed(stats?.expectedPayout), sub: 'Active leads — not yet disbursed', icon: <RiseOutlined />, gradient: 'linear-gradient(135deg, #b45309 0%, #fbbf24 100%)' },
    { key: 'total', title: 'Total Payout to Admin', value: aed(stats?.totalPayout), sub: 'Disbursed leads (paid + pending)', icon: <DollarOutlined />, gradient: 'linear-gradient(135deg, #0369a1 0%, #38bdf8 100%)' },
    { key: 'paid', title: 'Paid to Admin', value: aed(stats?.paidToAdmin), sub: 'Commissions already settled', icon: <BankOutlined />, gradient: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)' },
  ];

  return (
    <>
      {/* Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 55%, #7c3aed 100%)',
        borderRadius: 16,
        padding: '28px 32px',
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 8px 32px rgba(109,40,217,0.25)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -50, top: -50, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', right: 100, bottom: -70, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            Welcome, {user.name || user.email} 👋
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.68)' }}>
            Review incoming leads and set commission rules.
          </div>
        </div>
        <Link to="/agency/leads">
          <Button
            icon={<AuditOutlined />}
            size="middle"
            style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)', color: '#fff', borderRadius: 8, fontWeight: 600 }}
          >
            Open Lead Queue
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {cards.map((c) => (
          <Col xs={24} sm={12} lg={6} key={c.key}>
            <StatCard {...c} loading={!stats} />
          </Col>
        ))}
      </Row>

      {/* Payout Section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 4, height: 20, borderRadius: 2, background: 'linear-gradient(180deg, #6d28d9, #a78bfa)' }} />
        <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#64748b' }}>Admin Payouts</span>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {payoutCards.map((c) => (
          <Col xs={24} sm={8} key={c.key}>
            <PayoutCard {...c} loading={!stats} />
          </Col>
        ))}
      </Row>

      {/* Pipeline + Product Payouts + Top Agents */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          {leads ? <LeadPipeline pipelineStats={pipelineStats} /> : (
            <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0' }}>
              <Skeleton active paragraph={{ rows: 5 }} />
            </Card>
          )}
        </Col>
        <Col xs={24} lg={10}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Product Payouts */}
            <Card
              title={
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Product Payouts</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400, marginTop: 2 }}>Paid commissions by product</div>
                </div>
              }
              style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              styles={{ header: { borderBottom: '1px solid #f1f5f9', paddingTop: 16, paddingBottom: 12 }, body: { padding: '16px 24px' } }}
            >
              {productPayouts ? productPayouts.map((p, i) => (
                <div key={p.type}>
                  {i > 0 && <div style={{ height: 1, background: '#f1f5f9', margin: '12px 0' }} />}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      {p.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{p.label}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{p.count} paid lead{p.count !== 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: p.amount > 0 ? '#16a34a' : '#94a3b8' }}>
                      {aed(p.amount)}
                    </div>
                  </div>
                </div>
              )) : <Skeleton active paragraph={{ rows: 2 }} />}
            </Card>

          </div>
        </Col>
      </Row>
    </>
  );
}

export default AgencyDashboard;
