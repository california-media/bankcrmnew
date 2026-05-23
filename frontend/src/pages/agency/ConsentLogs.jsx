import { useEffect, useMemo, useState } from 'react';
import { Typography, Spin, Input, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../api/client';

const API_BY_ROLE = { admin: '/leads', agency: '/leads/agency', agent: '/leads/mine', employee: '/leads/assigned' };
const PATH_BY_ROLE = { admin: '/admin/leads', agency: '/agency/leads', agent: '/agent/leads', employee: '/employee/leads' };

const relTime = (date) => {
  const diff = Date.now() - new Date(date);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

const avatarBg = (name) => {
  const palette = ['#818cf8', '#a78bfa', '#60a5fa', '#34d399', '#f472b6', '#fb923c'];
  let h = 0;
  for (const c of (name || '')) h = h * 31 + c.charCodeAt(0);
  return palette[Math.abs(h) % palette.length];
};

const initials = (name) =>
  (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

const STATUS_COLOR = {
  blue: '#3b82f6', green: '#22c55e', gold: '#f59e0b', orange: '#f97316',
  red: '#ef4444', cyan: '#06b6d4', purple: '#a855f7', default: '#94a3b8',
};

const TEMPLATE =
  'Hi {customer}, Inizio Global here on behalf of {bank}. Please confirm you authorize us to process your {product} application{amount}. Reply YES to consent or STOP to cancel.';

function TemplatePreview() {
  const parts = TEMPLATE.split(/(\{[^}]+\})/g);
  return (
    <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.7 }}>
      {parts.map((p, i) =>
        p.startsWith('{') ? (
          <span key={i} style={{ color: '#4f46e5', fontWeight: 600 }}>{p}</span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </div>
  );
}

export default function ConsentLogs() {
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const role = user?.role;
  const apiUrl  = API_BY_ROLE[role]  || '/leads/agency';
  const leadPath = PATH_BY_ROLE[role] || '/agency/leads';
  const [leads, setLeads]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get(apiUrl)
      .then((r) => setLeads([...r.data].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiUrl]);

  // Flatten all consentStatusHistory entries across all leads into a single feed
  const feed = useMemo(() => {
    const q = search.trim().toLowerCase();
    const entries = leads.flatMap((lead) =>
      (lead.consentStatusHistory || []).map((h) => ({ ...h, lead }))
    );
    entries.sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt));
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.lead.customerName?.toLowerCase().includes(q) ||
        (e.lead.phone || '').includes(q) ||
        e.lead.bank?.name?.toLowerCase().includes(q)
    );
  }, [leads, search]);

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 130px)', minHeight: 400 }}>

      {/* LEFT — activity feed */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ marginBottom: 10 }}>
          <Typography.Title level={4} style={{ margin: 0, fontWeight: 600 }}>
            WhatsApp Consent Log
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Live thread of WhatsApp authorizations across all leads
          </Typography.Text>
        </div>

        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder="Search name, phone, bank…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 10 }}
        />

        <div style={{
          flex: 1, overflowY: 'auto', borderRadius: 12,
          border: '1px solid #e2e8f0', background: '#fff',
        }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
              <Spin />
            </div>
          ) : feed.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0', fontSize: 13 }}>
              No consent logs found
            </div>
          ) : (
            feed.map((entry, idx) => {
              const lead = entry.lead;
              const cs = entry.consentStatus;
              const productLabel = lead.productType === 'credit_card'
                ? (lead.cardProduct?.name || 'Credit Card')
                : (lead.loanProduct?.name || 'Loan');
              const bankName = lead.bank?.name || '';
              const csColor = cs ? (STATUS_COLOR[cs.color] || '#94a3b8') : '#94a3b8';
              const csLabel = cs ? cs.label.toUpperCase() : 'CLEARED';

              return (
                <div
                  key={`${lead._id}-${idx}`}
                  onClick={() => navigate(`${leadPath}/${lead._id}`)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: avatarBg(lead.customerName),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 12, fontWeight: 700,
                  }}>
                    {initials(lead.customerName)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                      {lead.customerName}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lead.phone}
                      {productLabel && <span> · {productLabel}</span>}
                      {bankName && <span> · {bankName}</span>}
                    </div>
                    {entry.changedBy && role !== 'agent' && role !== 'employee' && (
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
                        by {entry.changedBy.name || entry.changedBy.email}
                      </div>
                    )}
                  </div>

                  {/* Consent status badge */}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '3px 10px',
                    borderRadius: 999,
                    border: `1.5px solid ${csColor}`,
                    color: csColor,
                    background: cs ? `${csColor}14` : '#f1f5f9',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {csLabel}
                  </span>

                  {/* Time */}
                  <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0, minWidth: 52, textAlign: 'right' }}>
                    {relTime(entry.changedAt)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT — template panel */}
      <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div style={{
          borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff',
          padding: '16px 18px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>
            WhatsApp · Template
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
            Default consent template
          </div>
          <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', border: '1px solid #e2e8f0', marginBottom: 14 }}>
            <TemplatePreview />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Auto-resend after', value: '24 hours' },
              { label: 'Max attempts',      value: '3' },
              { label: 'Language',          value: 'English / Arabic auto' },
              { label: 'Compliance',        value: 'UAE CBUAE 2024-12' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: '#64748b' }}>{label}</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff',
          padding: '14px 16px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
            Consent Status Legend
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Status labels are defined under <strong>Lead Status</strong> settings (whatsapp_consent type).
              Use the Consent column in Lead Queue to set each lead's status after sending the WhatsApp link.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
