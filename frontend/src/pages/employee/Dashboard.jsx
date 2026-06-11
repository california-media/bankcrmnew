import { useEffect, useState } from 'react';
import { Card, Col, Row, Skeleton, Button } from 'antd';
import {
  AuditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  UnorderedListOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

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
const initials = (name) => (name || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

function RecentActivity({ leads, loading }) {
  if (loading) {
    return (
      <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0', marginTop: 20 }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }
  const recent = [...(leads || [])].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 8);
  return (
    <Card
      style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginTop: 20 }}
      styles={{ body: { padding: 0 } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a' }}>Recent activity</div>
        <Link to="/employee/leads" style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
          All leads <ArrowRightOutlined />
        </Link>
      </div>
      <div style={{ borderTop: '1px solid #f1f5f9' }}>
        {recent.length === 0 && (
          <div style={{ padding: '32px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No assigned leads yet</div>
        )}
        {recent.map((lead, i) => {
          const st = ACTIVITY_STATUS[lead.status] || ACTIVITY_STATUS.submitted;
          const avatarIdx = i % AVATAR_BG.length;
          const productLabel = lead.productType === 'credit_card' ? 'Credit Card' : 'Loan';
          const bankName = lead.bank?.name || '—';
          const amount = lead.loanAmount ? `AED ${Number(lead.loanAmount).toLocaleString()}` : lead.commission ? `AED ${Number(lead.commission).toLocaleString()}` : '';
          return (
            <Link key={lead._id} to={`/employee/leads/${lead._id}`} style={{ display: 'block', textDecoration: 'none' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderBottom: i < recent.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: AVATAR_BG[avatarIdx], color: AVATAR_COLOR[avatarIdx], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                  {initials(lead.customerName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.customerName}</div>
                  <div style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{productLabel} · {bankName}{amount ? ` · ${amount}` : ''}</div>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, flexShrink: 0, background: st.bg, border: `1.5px solid ${st.border}`, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: st.text }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                  {st.label}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: 12, flexShrink: 0 }}>{dayjs(lead.updatedAt || lead.createdAt).fromNow()}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

const StatCard = ({ title, value, icon, gradient, shadowColor, loading }) =>
  loading ? (
    <Card styles={{ body: { padding: '22px 24px' } }} style={{ borderRadius: 16, border: '1px solid #e2e8f0', height: '100%' }}>
      <Skeleton active paragraph={{ rows: 1 }} />
    </Card>
  ) : (
    <div
      style={{ borderRadius: 16, background: gradient, boxShadow: `0 8px 28px ${shadowColor}55, 0 2px 8px ${shadowColor}30`, height: '100%', overflow: 'hidden', padding: '24px', position: 'relative', transition: 'box-shadow 0.25s, transform 0.25s', cursor: 'default' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 20px 52px ${shadowColor}70, 0 6px 18px ${shadowColor}45`; e.currentTarget.style.transform = 'translateY(-3px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 8px 28px ${shadowColor}55, 0 2px 8px ${shadowColor}30`; e.currentTarget.style.transform = 'translateY(0)'; }}
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
    </div>
  );

function EmployeeDashboard() {
  const { user } = useSelector((s) => s.auth);
  const [leads, setLeads] = useState(null);

  useEffect(() => {
    api.get('/leads/assigned').then((res) => setLeads(res.data));
  }, []);

  const stats = leads
    ? {
        total: leads.length,
        pending: leads.filter((l) => ['submitted', 'under_review', 'assigned'].includes(l.status)).length,
        approved: leads.filter((l) => ['approved', 'disbursed'].includes(l.status)).length,
        rejected: leads.filter((l) => l.status === 'rejected').length,
      }
    : null;

  const cards = [
    { key: 'total', title: 'Total Assigned', value: stats?.total, icon: <AuditOutlined />, gradient: 'linear-gradient(135deg, #1d4ed8 0%, #60a5fa 100%)', shadowColor: '#1d4ed8' },
    { key: 'pending', title: 'In Progress', value: stats?.pending, icon: <ClockCircleOutlined />, gradient: 'linear-gradient(135deg, #b45309 0%, #fbbf24 100%)', shadowColor: '#b45309' },
    { key: 'approved', title: 'Approved / Disbursed', value: stats?.approved, icon: <CheckCircleOutlined />, gradient: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)', shadowColor: '#15803d' },
    { key: 'rejected', title: 'Rejected', value: stats?.rejected, icon: <CloseCircleOutlined />, gradient: 'linear-gradient(135deg, #b91c1c 0%, #f87171 100%)', shadowColor: '#b91c1c' },
  ];

  return (
    <>
      {/* Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 55%, #0ea5e9 100%)',
        borderRadius: 16,
        padding: '28px 32px',
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 8px 32px rgba(3,105,161,0.25)',
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
            Your assigned leads overview.
          </div>
        </div>
        <Link to="/employee/leads">
          <Button
            icon={<UnorderedListOutlined />}
            size="middle"
            style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)', color: '#fff', borderRadius: 8, fontWeight: 600 }}
          >
            View My Leads
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col xs={24} sm={12} lg={6} key={c.key}>
            <StatCard {...c} loading={!leads} />
          </Col>
        ))}
      </Row>

      {/* Recent Activity */}
      <RecentActivity leads={leads} loading={leads === null} />
    </>
  );
}

export default EmployeeDashboard;
