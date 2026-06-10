import { useEffect, useMemo, useState } from 'react';
import { Table, Button, Input, Select, Tabs, Row, Col, Tag } from 'antd';
import { PlusOutlined, SearchOutlined, TableOutlined, AppstoreOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';

const STATUSES = [
  { value: 'draft', label: 'Draft', color: 'default' },
  { value: 'submitted', label: 'Submitted', color: 'blue' },
  { value: 'under_review', label: 'Under Review', color: 'gold' },
  { value: 'assigned', label: 'Assigned', color: 'cyan' },
  { value: 'approved', label: 'Approved', color: 'green' },
  { value: 'rejected', label: 'Rejected', color: 'red' },
  { value: 'disbursed', label: 'Disbursed', color: 'purple' },
];

const PRODUCTS = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'loan', label: 'Loan' },
];

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const STATUS_PILL = {
  draft:        { bg: '#f8fafc', border: '#e2e8f0', dot: '#94a3b8', text: '#475569', label: 'DRAFT' },
  submitted:    { bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6', text: '#1d4ed8', label: 'SUBMITTED' },
  under_review: { bg: '#fefce8', border: '#fde68a', dot: '#eab308', text: '#a16207', label: 'REVIEWING' },
  assigned:     { bg: '#ecfdf5', border: '#6ee7b7', dot: '#10b981', text: '#047857', label: 'ASSIGNED' },
  approved:     { bg: '#f0fdf4', border: '#bbf7d0', dot: '#22c55e', text: '#15803d', label: 'APPROVED' },
  rejected:     { bg: '#fef2f2', border: '#fecaca', dot: '#ef4444', text: '#b91c1c', label: 'REJECTED' },
  disbursed:    { bg: '#faf5ff', border: '#e9d5ff', dot: '#a855f7', text: '#7e22ce', label: 'DISBURSED' },
};

const relTime = (date) => {
  const diff = Date.now() - new Date(date);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

const ColHead = ({ children }) => (
  <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.8, textTransform: 'uppercase' }}>{children}</span>
);

const StatusPill = ({ status }) => {
  const p = STATUS_PILL[status] || { bg: '#f1f5f9', border: '#e2e8f0', dot: '#94a3b8', text: '#475569', label: (status || '').toUpperCase() };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: p.bg, border: `1px solid ${p.border}`, fontSize: 11, fontWeight: 700, color: p.text, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, flexShrink: 0 }} />
      {p.label}
    </span>
  );
};

function MyLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState();
  const [labelStatuses, setLabelStatuses] = useState([]);
  const [productFilter, setProductFilter] = useState();
  const [leadsTab, setLeadsTab] = useState('active');
  const [viewMode, setViewMode] = useState('table');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads/mine');
      setLeads(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get('/employee-statuses?statusType=lead_label').then((r) => setLabelStatuses(r.data.filter((s) => s.isActive))).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      const isPendingReferral = l.isReferral && !l.productType;
      if (leadsTab === 'referral' && !isPendingReferral) return false;
      if (leadsTab === 'archive' && l.status !== 'disbursed') return false;
      if (leadsTab === 'rejected' && l.status !== 'rejected') return false;
      if (leadsTab === 'active' && (l.status === 'disbursed' || l.status === 'rejected' || isPendingReferral)) return false;
      if (q && !l.customerName.toLowerCase().includes(q) && !(l.leadNumber || '').toLowerCase().includes(q)) return false;
      if (statusFilter && String(l.employeeStatus?._id) !== statusFilter) return false;
      if (productFilter && l.productType !== productFilter) return false;
      return true;
    });
  }, [leads, search, statusFilter, productFilter, leadsTab]);

  const activeCount = leads.filter(l => l.status !== 'disbursed' && l.status !== 'rejected' && !(l.isReferral && !l.productType)).length;
  const rejectedCount = leads.filter(l => l.status === 'rejected').length;
  const archiveCount = leads.filter(l => l.status === 'disbursed').length;
  const referralCount = leads.filter(l => l.isReferral && !l.productType).length;

  const renderProduct = (row) => {
    if (row.productType === 'credit_card' && row.cardProduct) return row.cardProduct.name || 'Credit Card';
    if (row.productType === 'loan' && row.loanProduct) return row.loanProduct.name || 'Loan';
    return PRODUCTS.find((p) => p.value === row.productType)?.label || row.productType;
  };

  const columns = [
    {
      title: <ColHead>Lead</ColHead>,
      width: 175,
      render: (_, row) => (
        <div style={{ lineHeight: 1.5 }}>
          <div style={{ fontWeight: 500, fontSize: 14, color: '#0f172a' }}>{row.customerName}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{row.leadNumber || '—'}</div>
          <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{row.phone}</div>
        </div>
      ),
    },
    {
      title: <ColHead>Product</ColHead>,
      render: (_, row) => {
        const name = renderProduct(row);
        return <span style={{ fontSize: 12, color: '#334155' }}>{name}</span>;
      },
    },
    {
      title: <ColHead>Bank</ColHead>,
      render: (_, row) => <span style={{ fontSize: 12, color: '#334155' }}>{row.bank?.name || '—'}</span>,
    },
    {
      title: <ColHead>Status</ColHead>,
      render: (_, row) => {
        const badges = (row.cpvDone || row.activateDone) ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            {row.cpvDone && <span style={{ fontSize: 9, fontWeight: 700, color: '#15803d', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 999, padding: '0 5px', whiteSpace: 'nowrap' }}>CPV ✓</span>}
            {row.activateDone && <span style={{ fontSize: 9, fontWeight: 700, color: '#15803d', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 999, padding: '0 5px', whiteSpace: 'nowrap' }}>Activated ✓</span>}
          </div>
        ) : null;
        if (['approved', 'disbursed'].includes(row.status)) return <div><StatusPill status={row.status} />{badges}</div>;
        if (!row.employeeStatus) return <div><StatusPill status={row.status} />{badges}</div>;
        const COLOR_MAP = { blue: '#3b82f6', green: '#22c55e', gold: '#eab308', orange: '#f97316', red: '#ef4444', cyan: '#06b6d4', purple: '#a855f7', default: '#94a3b8', volcano: '#f97316' };
        const c = COLOR_MAP[row.employeeStatus.color] || '#94a3b8';
        return (
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, border: `1.5px solid ${c}`, fontSize: 11, fontWeight: 700, color: c, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              {row.employeeStatus.label}
            </span>
            {badges}
          </div>
        );
      },
    },
    {
      title: <ColHead>Consent</ColHead>,
      render: (_, row) => {
        const s = row.consentStatus;
        if (!s) return <span style={{ color: '#cbd5e1' }}>—</span>;
        const COLOR_MAP = { blue: '#3b82f6', green: '#22c55e', gold: '#eab308', orange: '#f97316', red: '#ef4444', cyan: '#06b6d4', purple: '#a855f7', default: '#94a3b8', volcano: '#f97316' };
        const c = COLOR_MAP[s.color] || '#94a3b8';
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, border: `1.5px solid ${c}`, fontSize: 11, fontWeight: 700, color: c, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            {s.label}
          </span>
        );
      },
    },
    {
      title: <ColHead>Updated</ColHead>,
      dataIndex: 'updatedAt',
      render: (d) => <span style={{ fontSize: 12, color: '#64748b' }}>{d ? relTime(d) : '—'}</span>,
    },
    {
      title: <ColHead>Expected Earning</ColHead>,
      align: 'right',
      render: (_, row) => (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: row.commissionStatus === 'paid' ? '#16a34a' : '#4f46e5' }}>{aed(row.commission)}</div>
          {row.commissionStatus === 'paid' && <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>RECEIVED</div>}
        </div>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>My Leads</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>Table</Button>
          <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} onClick={() => setViewMode('card')}>Cards</Button>
          <Link to="/agent/leads/new">
            <Button type="primary" icon={<PlusOutlined />}>New Lead</Button>
          </Link>
        </div>
      </div>

      <div className="leads-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Input
          allowClear
          placeholder="Search by client name or lead ID..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280, flexShrink: 0, borderRadius: 6 }}
        />
        <Select
          allowClear
          placeholder="All Stages"
          value={statusFilter}
          onChange={setStatusFilter}
          options={labelStatuses.map((s) => ({ value: String(s._id), label: s.label }))}
          style={{ width: 180, flexShrink: 0, borderRadius: 6 }}
        />
        <Select
          allowClear
          placeholder="All Products"
          value={productFilter}
          onChange={setProductFilter}
          options={PRODUCTS}
          style={{ width: 180, flexShrink: 0, borderRadius: 6 }}
        />
      </div>

      <Tabs
        activeKey={leadsTab}
        onChange={setLeadsTab}
        style={{ marginBottom: 8 }}
        items={[
          { key: 'active', label: `Active (${activeCount})` },
          { key: 'referral', label: `Referral Leads (${referralCount})` },
          { key: 'rejected', label: `Rejected (${rejectedCount})` },
          { key: 'archive', label: `Approved (${archiveCount})` },
        ]}
      />

      {viewMode === 'table' ? (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <Table
            size="small"
            rowKey="_id"
            loading={loading}
            dataSource={filtered}
            columns={columns}
            onRow={(row) => ({ onClick: () => navigate(`/agent/leads/${row._id}`), style: { cursor: 'pointer' } })}
          />
        </div>
      ) : (
        <Row gutter={[14, 14]}>
          {filtered.map((row) => {
            const statusMeta = STATUSES.find((x) => x.value === row.status);
            return (
              <Col key={row._id} xs={24} sm={12} lg={8} xl={6}>
                <div
                  onClick={() => navigate(`/agent/leads/${row._id}`)}
                  className="lead-card"
                  style={{
                    borderRadius: 14, border: '1px solid #e0e2f7', cursor: 'pointer', height: '100%',
                    background: '#fff', padding: '14px 16px',
                    boxShadow: '0 2px 12px rgba(99,102,241,0.07), 0 1px 3px rgba(99,102,241,0.04)',
                    transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>{row.leadNumber || '—'}</span>
                    <Tag color={statusMeta?.color} style={{ margin: 0, fontSize: 10 }}>{statusMeta?.label || row.status}</Tag>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', marginBottom: 2 }}>{row.customerName}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>{row.phone}</div>
                  {row.bank?.name && (
                    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 500, color: '#4f46e5', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 999, padding: '2px 10px', marginBottom: 10 }}>
                      {row.bank.name}
                    </span>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#334155' }}>{renderProduct(row)}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{relTime(row.updatedAt || row.createdAt)}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: row.commissionStatus === 'paid' ? '#16a34a' : '#4f46e5' }}>{aed(row.commission)}</span>
                  </div>
                </div>
              </Col>
            );
          })}
          {filtered.length === 0 && (
            <Col span={24} style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>No leads found</Col>
          )}
        </Row>
      )}
    </>
  );
}

export default MyLeads;
