import { useEffect, useState, useMemo } from 'react';
import { Typography, Spin, message, Segmented, Select } from 'antd';
import { CreditCardOutlined, BankOutlined } from '@ant-design/icons';
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
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

const COLOR_MAP = {
  blue:    { dot: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8' },
  green:   { dot: '#22c55e', bg: '#f0fdf4', text: '#15803d' },
  gold:    { dot: '#f59e0b', bg: '#fffbeb', text: '#b45309' },
  orange:  { dot: '#f97316', bg: '#fff7ed', text: '#c2410c' },
  red:     { dot: '#ef4444', bg: '#fef2f2', text: '#b91c1c' },
  cyan:    { dot: '#06b6d4', bg: '#ecfeff', text: '#0e7490' },
  purple:  { dot: '#a855f7', bg: '#faf5ff', text: '#7e22ce' },
  volcano: { dot: '#f97316', bg: '#fff7ed', text: '#c2410c' },
  default: { dot: '#94a3b8', bg: '#f1f5f9', text: '#64748b' },
};

const LEADS_URL = { admin: '/leads', agency: '/leads/agency', employee: '/leads/assigned' };
const LEAD_PATH = { admin: '/admin/leads', agency: '/agency/leads', employee: '/employee/leads' };

const PRODUCT_TYPE_LABELS = {
  credit_card: 'Credit Card',
  loan: 'Loan',
  personal_loan: 'Personal Loan',
  mortgage: 'Mortgage',
  auto_loan: 'Auto Loan',
  sme_account: 'SME Account',
  business_loan: 'Business Loan',
};

function uniq(arr, key) {
  const seen = new Set();
  return arr.filter((x) => {
    const v = key(x);
    if (!v || seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

function LeadCard({ lead, onClick, accentColor }) {
  const isLoan = lead.productType === 'loan';
  const productName = isLoan
    ? (lead.loanProduct?.loanCategory
        ? (PRODUCT_TYPE_LABELS[lead.loanProduct.loanCategory] || lead.loanProduct.loanCategory.toUpperCase())
        : 'Loan')
    : 'Credit Card';
  const bankName = lead.bank?.name || '—';
  const amount = isLoan && lead.loanAmount ? aed(lead.loanAmount) : null;
  const commission = lead.grossCommission > 0 ? aed(lead.grossCommission) : null;
  const leadNum = lead.leadNumber || `LD-${String(lead._id).slice(-6)}`;

  return (
    <div
      onClick={onClick}
      style={{
        background: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e8edf3',
        padding: '12px 14px',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(15,23,42,0.07)',
        transition: 'box-shadow 0.18s, transform 0.12s, border-color 0.18s',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 6px 20px ${accentColor}40, 0 2px 6px ${accentColor}20`;
        e.currentTarget.style.borderColor = `${accentColor}55`;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.07)';
        e.currentTarget.style.borderColor = '#e8edf3';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Name */}
      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 2 }}>
        {lead.customerName}
      </div>

      {/* Lead ID · Bank */}
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, fontFamily: 'monospace', letterSpacing: 0.2 }}>
        {leadNum} · {bankName}
      </div>

      {/* Product type + Amount */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          {productName}
        </span>
        {amount && (
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{amount}</span>
        )}
      </div>

      {/* Time + Commission */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{relTime(lead.updatedAt)}</span>
        {commission && (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5' }}>{commission}</span>
        )}
      </div>
    </div>
  );
}

export default function Pipeline() {
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const role = user?.role;
  const leadsUrl = LEADS_URL[role] || '/leads/agency';
  const leadPath = LEAD_PATH[role] || '/agency/leads';

  const [leads, setLeads] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  const [productType, setProductType] = useState('credit_card');
  const [bankFilter, setBankFilter]     = useState(null);
  const [agentFilter, setAgentFilter]   = useState(null);
  const [agencyFilter, setAgencyFilter] = useState(null);

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
  }, [leadsUrl]);

  const bankOptions = useMemo(() =>
    uniq(leads.filter((l) => l.bank), (l) => l.bank._id)
      .map((l) => ({ value: l.bank._id, label: l.bank.name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [leads]
  );

  const agentOptions = useMemo(() =>
    uniq(leads.filter((l) => l.agent), (l) => l.agent._id || l.agent)
      .map((l) => ({ value: l.agent._id || l.agent, label: l.agent.name || l.agent.email || 'Agent' }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [leads]
  );

  const agencyOptions = useMemo(() =>
    uniq(leads.filter((l) => l.agency), (l) => l.agency._id || l.agency)
      .map((l) => ({ value: l.agency._id || l.agency, label: l.agency.name || l.agency.email || 'Agency' }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [leads]
  );

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (l.productType !== productType) return false;
      if (bankFilter   && l.bank?._id !== bankFilter) return false;
      if (agentFilter  && (l.agent?._id  || l.agent)  !== agentFilter)  return false;
      if (agencyFilter && (l.agency?._id || l.agency) !== agencyFilter) return false;
      return true;
    });
  }, [leads, productType, bankFilter, agentFilter, agencyFilter]);

  const getColId = (lead) => lead.employeeStatus?._id || '__none__';
  const leadsForCol = (colId) => filtered.filter((l) => getColId(l) === colId);

  const creditCardCount = leads.filter((l) => l.productType === 'credit_card').length;
  const loanCount       = leads.filter((l) => l.productType === 'loan').length;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0, fontWeight: 700 }}>Pipeline board</Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Kanban view of every lead by stage · {filtered.length} leads
          </Typography.Text>
        </div>

        <Segmented
          value={productType}
          onChange={(v) => { setProductType(v); setBankFilter(null); setAgentFilter(null); setAgencyFilter(null); }}
          options={[
            {
              value: 'credit_card',
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <CreditCardOutlined />
                  Credit Card
                  <span style={{ fontSize: 10, fontWeight: 700, background: '#e0e7ff', color: '#4f46e5', borderRadius: 999, padding: '0 6px', marginLeft: 2 }}>
                    {creditCardCount}
                  </span>
                </span>
              ),
            },
            {
              value: 'loan',
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <BankOutlined />
                  Loan
                  <span style={{ fontSize: 10, fontWeight: 700, background: '#dcfce7', color: '#16a34a', borderRadius: 999, padding: '0 6px', marginLeft: 2 }}>
                    {loanCount}
                  </span>
                </span>
              ),
            },
          ]}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <Select
          allowClear
          placeholder="All Banks"
          value={bankFilter}
          onChange={setBankFilter}
          options={bankOptions}
          style={{ minWidth: 150 }}
          size="small"
        />
        {role !== 'employee' && (
          <Select
            allowClear
            placeholder="All Agents"
            value={agentFilter}
            onChange={setAgentFilter}
            options={agentOptions}
            style={{ minWidth: 150 }}
            size="small"
          />
        )}
        {role === 'admin' && (
          <Select
            allowClear
            placeholder="All Agencies"
            value={agencyFilter}
            onChange={setAgencyFilter}
            options={agencyOptions}
            style={{ minWidth: 150 }}
            size="small"
          />
        )}
        {(bankFilter || agentFilter || agencyFilter) && (
          <button
            onClick={() => { setBankFilter(null); setAgentFilter(null); setAgencyFilter(null); }}
            style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Kanban board */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          overflowX: 'auto',
          alignItems: 'flex-start',
          paddingBottom: 20,
          paddingTop: 4,
        }}
      >
        {columns.map((col) => {
          const colId = String(col._id);
          const colLeads = leadsForCol(colId);
          const colors = COLOR_MAP[col.color] || COLOR_MAP.default;

          return (
            <div
              key={colId}
              style={{
                minWidth: 260,
                width: 260,
                flexShrink: 0,
                background: '#f8fafc',
                borderRadius: 16,
                boxShadow: '0 4px 16px rgba(15,23,42,0.08)',
                border: '1px solid #e8edf3',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Column header */}
              <div style={{
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fff',
                borderBottom: '1px solid #f1f5f9',
              }}>
                {/* Status pill */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: colors.bg,
                  border: `1.5px solid ${colors.dot}22`,
                  borderRadius: 999,
                  padding: '4px 10px 4px 8px',
                }}>
                  <span style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: colors.dot,
                    flexShrink: 0,
                    boxShadow: `0 0 0 2px ${colors.dot}33`,
                  }} />
                  <span style={{
                    fontWeight: 800,
                    fontSize: 11,
                    color: colors.text,
                    textTransform: 'uppercase',
                    letterSpacing: 0.8,
                    whiteSpace: 'nowrap',
                  }}>
                    {col.label}
                  </span>
                </div>

                {/* Count badge */}
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#64748b',
                  background: '#f1f5f9',
                  borderRadius: 999,
                  padding: '2px 8px',
                  minWidth: 24,
                  textAlign: 'center',
                }}>
                  {colLeads.length}
                </span>
              </div>

              {/* Cards */}
              <div style={{
                padding: '10px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                minHeight: 80,
                maxHeight: 'calc(100vh - 260px)',
                overflowY: 'auto',
              }}>
                {colLeads.map((lead) => (
                  <LeadCard
                    key={lead._id}
                    lead={lead}
                    accentColor={colors.dot}
                    onClick={() => navigate(`${leadPath}/${lead._id}`)}
                  />
                ))}
                {colLeads.length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    color: '#cbd5e1',
                    fontSize: 12,
                    padding: '24px 0',
                    fontStyle: 'italic',
                  }}>
                    No leads
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {columns.length === 0 && (
          <div style={{ color: '#94a3b8', fontSize: 13, padding: 24 }}>
            No pipeline stages configured. Add lead labels in Admin → Lead Status.
          </div>
        )}
      </div>
    </>
  );
}
