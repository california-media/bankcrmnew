import { useEffect, useState } from 'react';
import { Typography, Spin, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;
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

const COLOR_MAP = {
  blue: '#3b82f6', green: '#22c55e', gold: '#f59e0b', orange: '#f97316',
  red: '#ef4444', cyan: '#06b6d4', purple: '#a855f7', volcano: '#f97316',
  default: '#94a3b8',
};

const LEADS_URL = { admin: '/leads', agency: '/leads/agency', employee: '/leads/assigned' };
const LEAD_PATH = { admin: '/admin/leads', agency: '/agency/leads', employee: '/employee/leads' };

export default function Pipeline() {
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const role = user?.role;
  const leadsUrl = LEADS_URL[role] || '/leads/agency';
  const leadPath = LEAD_PATH[role] || '/agency/leads';

  const [leads, setLeads] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [leadsRes, colsRes] = await Promise.all([
          api.get(leadsUrl),
          api.get('/employee-statuses?statusType=lead_label'),
        ]);
        setLeads(leadsRes.data);
        setColumns(colsRes.data.filter((c) => c.isActive));
      } catch {
        message.error('Failed to load pipeline');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const getColId = (lead) => lead.employeeStatus?._id || '__none__';
  const leadsForCol = (colId) => leads.filter((l) => getColId(l) === colId);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0, fontWeight: 500 }}>Pipeline</Typography.Title>
        <Typography.Text type="secondary">Lead pipeline overview by stage.</Typography.Text>
      </div>

      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 16 }}>
        {columns.map((col) => {
          const colId = String(col._id);
          const colLeads = leadsForCol(colId);
          const accent = COLOR_MAP[col.color] || '#94a3b8';

          return (
            <div
              key={colId}
              style={{
                minWidth: 240,
                width: 240,
                flexShrink: 0,
                background: '#f8fafc',
                borderRadius: 12,
                border: '1.5px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ padding: '10px 14px 8px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 12, color: '#1e293b', textTransform: 'uppercase', letterSpacing: 0.7, flex: 1 }}>
                  {col.label}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', background: '#e2e8f0', borderRadius: 999, padding: '1px 7px' }}>
                  {colLeads.length}
                </span>
              </div>

              <div style={{ padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
                {colLeads.map((lead) => {
                  const productLabel = lead.productType === 'credit_card' ? 'Credit Card' : 'Loan';
                  const bankName = lead.bank?.name || '—';
                  const amount = lead.productType === 'loan' && lead.loanAmount
                    ? aed(lead.loanAmount)
                    : lead.productType === 'credit_card'
                    ? lead.cardProduct?.name || 'Credit Card'
                    : '—';

                  return (
                    <div
                      key={lead._id}
                      onClick={() => navigate(`${leadPath}/${lead._id}`)}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        padding: '10px 12px',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                        transition: 'box-shadow 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 3px 10px rgba(15,23,42,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.06)'}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>{lead.customerName}</div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6, fontFamily: 'monospace' }}>
                        {lead.leadNumber || `LD-${String(lead._id).slice(-6)}`}
                        {bankName !== '—' && <span> · {bankName}</span>}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4 }}>
                          {productLabel}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5' }}>
                          {typeof amount === 'string' && amount.startsWith('AED') ? amount : null}
                        </span>
                      </div>
                      {lead.commission > 0 && (
                        <div style={{ marginTop: 6, fontSize: 10, color: '#16a34a', fontWeight: 600 }}>
                          {aed(lead.commission)}
                        </div>
                      )}
                      <div style={{ marginTop: 4, fontSize: 10, color: '#94a3b8' }}>{relTime(lead.updatedAt)}</div>
                    </div>
                  );
                })}
                {colLeads.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#cbd5e1', fontSize: 12, padding: '20px 0' }}>
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
