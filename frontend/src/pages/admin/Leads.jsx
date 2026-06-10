import { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Typography, Input, Select, DatePicker, Space, Button, Tabs, Tooltip, Card, Row, Col, ConfigProvider } from 'antd';
import { SearchOutlined, TableOutlined, AppstoreOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
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

const ColHead = ({ children }) => (
  <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.8, textTransform: 'uppercase' }}>{children}</span>
);

const STATUS_PILL = {
  draft:        { bg: '#f8fafc', border: '#e2e8f0', dot: '#94a3b8', text: '#475569', label: 'DRAFT' },
  submitted:    { bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6', text: '#1d4ed8', label: 'SUBMITTED' },
  under_review: { bg: '#fefce8', border: '#fde68a', dot: '#eab308', text: '#a16207', label: 'REVIEWING' },
  assigned:     { bg: '#ecfdf5', border: '#6ee7b7', dot: '#10b981', text: '#047857', label: 'ASSIGNED' },
  approved:     { bg: '#f0fdf4', border: '#bbf7d0', dot: '#22c55e', text: '#15803d', label: 'APPROVED' },
  rejected:     { bg: '#fef2f2', border: '#fecaca', dot: '#ef4444', text: '#b91c1c', label: 'REJECTED' },
  disbursed:    { bg: '#faf5ff', border: '#e9d5ff', dot: '#a855f7', text: '#7e22ce', label: 'DISBURSED' },
};

const StatusPill = ({ status }) => {
  const p = STATUS_PILL[status] || { bg: '#f1f5f9', border: '#e2e8f0', dot: '#94a3b8', text: '#475569', label: (status || '').toUpperCase() };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: p.bg, border: `1px solid ${p.border}`, fontSize: 10, fontWeight: 700, color: p.text, whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: p.dot, flexShrink: 0 }} />
      {p.label}
    </span>
  );
};

function AdminLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState();
  const [labelStatuses, setLabelStatuses] = useState([]);
  const [productFilter, setProductFilter] = useState();
  const [dateRange, setDateRange] = useState(null);

  const [leadsTab, setLeadsTab] = useState('active');
  const [viewMode, setViewMode] = useState('table');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads');
      setLeads(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get('/employee-statuses?statusType=lead_label').then((r) => setLabelStatuses(r.data.filter((s) => s.isActive))).catch(() => {});
  }, []);

  const activeCount = leads.filter(l => l.status !== 'disbursed' && l.status !== 'rejected' && !l.isReferral).length;
  const rejectedCount = leads.filter(l => l.status === 'rejected').length;
  const archiveCount = leads.filter(l => l.status === 'disbursed').length;
  const referralCount = leads.filter(l => l.isReferral).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const [from, to] = dateRange || [];
    return leads.filter((l) => {
      if (leadsTab === 'referral' && !l.isReferral) return false;
      if (leadsTab === 'archive' && l.status !== 'disbursed') return false;
      if (leadsTab === 'rejected' && l.status !== 'rejected') return false;
      if (leadsTab === 'active' && (l.status === 'disbursed' || l.status === 'rejected' || l.isReferral)) return false;
      if (q && !l.customerName.toLowerCase().includes(q) && !String(l._id).toLowerCase().includes(q)) return false;
      if (statusFilter && String(l.employeeStatus?._id) !== statusFilter) return false;
      if (productFilter && l.productType !== productFilter) return false;
      if (from && dayjs(l.createdAt).isBefore(from.startOf('day'))) return false;
      if (to && dayjs(l.createdAt).isAfter(to.endOf('day'))) return false;
      return true;
    });
  }, [leads, search, statusFilter, productFilter, dateRange, leadsTab]);

  const renderProduct = (row) => {
    const name = row.productType === 'credit_card' ? row.cardProduct?.name : row.loanProduct?.name;
    const sub = row.productType === 'credit_card'
      ? (row.cardProduct?.cardType === 'premium' ? 'Premium' : 'Regular')
      : (row.loanProduct?.loanCategory === 'mortgage' ? 'Mortgage' : 'Personal');
    if (!name) return PRODUCTS.find((p) => p.value === row.productType)?.label || row.productType;
    return (
      <Tooltip title={name}>
        <div>
          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontSize: 11, color: '#888' }}>{sub}</div>
        </div>
      </Tooltip>
    );
  };

  const relTime = (v) => {
    if (!v) return '—';
    const diff = Date.now() - new Date(v);
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

  const columns = [
    {
      title: <ColHead>Lead</ColHead>,
      width: 130,
      render: (_, row) => (
        <div style={{ lineHeight: 1.5 }}>
          <div style={{ fontWeight: 500, fontSize: 13, color: '#0f172a' }}>{row.customerName}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{row.leadNumber || '—'}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{row.phone}</div>
        </div>
      ),
    },
    {
      title: <ColHead>Agent</ColHead>,
      width: 85,
      ellipsis: true,
      render: (_, row) => <span style={{ fontSize: 12, color: '#334155' }}>{row.agent?.name || '—'}</span>,
    },
    {
      title: <ColHead>Agency</ColHead>,
      width: 85,
      ellipsis: true,
      render: (_, row) => <span style={{ fontSize: 12, color: '#334155' }}>{row.agency?.name || '—'}</span>,
    },
    {
      title: <ColHead>Product</ColHead>,
      width: 110,
      render: (_, row) => {
        const name = row.productType === 'credit_card' ? row.cardProduct?.name : row.loanProduct?.name;
        const fallback = row.productType === 'credit_card' ? 'Credit Card' : 'Loan';
        return (
          <Tooltip title={name || fallback}>
            <span style={{ fontSize: 12, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
              {name || fallback}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: <ColHead>Bank</ColHead>,
      width: 90,
      ellipsis: true,
      render: (_, row) => <span style={{ fontSize: 12, color: '#334155' }}>{row.bank?.name || '—'}</span>,
    },
    {
      title: <ColHead>Status</ColHead>,
      width: 120,
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
            <Tooltip title={row.employeeStatus.label}>
              <span style={{ display: 'inline-block', maxWidth: 110, padding: '3px 8px', borderRadius: 999, border: `1.5px solid ${c}`, fontSize: 10, fontWeight: 700, color: c, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.employeeStatus.label}
              </span>
            </Tooltip>
            {badges}
          </div>
        );
      },
    },
    {
      title: <ColHead>Consent</ColHead>,
      width: 100,
      render: (_, row) => {
        const s = row.consentStatus;
        if (!s) return <span style={{ color: '#cbd5e1' }}>—</span>;
        const COLOR_MAP = { blue: '#3b82f6', green: '#22c55e', gold: '#eab308', orange: '#f97316', red: '#ef4444', cyan: '#06b6d4', purple: '#a855f7', default: '#94a3b8' };
        const c = COLOR_MAP[s.color] || '#94a3b8';
        return (
          <Tooltip title={s.label}>
            <span style={{ display: 'inline-block', maxWidth: 90, padding: '3px 8px', borderRadius: 999, border: `1.5px solid ${c}`, fontSize: 10, fontWeight: 700, color: c, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.label}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: <ColHead>Updated</ColHead>,
      dataIndex: 'updatedAt',
      width: 90,
      render: (v) => <span style={{ fontSize: 12, color: '#64748b' }}>{relTime(v)}</span>,
    },
    {
      title: <ColHead>Commission</ColHead>,
      width: 120,
      align: 'right',
      render: (_, row) => {
        const COLOR = { paid: '#16a34a', payable: '#4f46e5', pending: '#d97706', none: '#4f46e5' };
        const LABEL = { paid: 'PAID', payable: 'PAYABLE', pending: 'PENDING' };
        const c = COLOR[row.commissionStatus] || COLOR.none;
        return (
          <div style={{ textAlign: 'right', lineHeight: 1.4 }}>
            {row.grossCommission > 0 && (
              <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 1 }}>Gross: {aed(row.grossCommission)}</div>
            )}
            <div style={{ fontWeight: 700, fontSize: 13, color: c }}>{aed(row.commission)}</div>
            {row.commissionStatus !== 'none' && LABEL[row.commissionStatus] && (
              <div style={{ fontSize: 10, fontWeight: 700, color: c, letterSpacing: 0.4 }}>{LABEL[row.commissionStatus]}</div>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <ConfigProvider theme={{ token: { borderRadius: 6 } }}>
      <div className="leads-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Input
            allowClear
            placeholder="Search client or lead ID..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280, flexShrink: 0 }}
          />
          <Select
            allowClear
            placeholder="All Stages"
            value={statusFilter}
            onChange={setStatusFilter}
            options={labelStatuses.map((s) => ({ value: String(s._id), label: s.label }))}
            style={{ width: 160, flexShrink: 0 }}
          />
          <Select
            allowClear
            placeholder="All Products"
            value={productFilter}
            onChange={setProductFilter}
            options={PRODUCTS}
            style={{ width: 160, flexShrink: 0 }}
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={setDateRange}
            allowClear
            style={{ width: 240, flexShrink: 0 }}
          />
          {(search || statusFilter || productFilter || dateRange) && (
            <Button onClick={() => { setSearch(''); setStatusFilter(undefined); setProductFilter(undefined); setDateRange(null); }}>
              Clear Filters
            </Button>
          )}
          <div style={{ flex: 1 }} />
          <Space size={8}>
            <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{filtered.length} shown</Typography.Text>
            <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>Table</Button>
            <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} onClick={() => setViewMode('card')}>Cards</Button>
          </Space>
        </div>
      </ConfigProvider>
        <Tabs
          activeKey={leadsTab}
          onChange={setLeadsTab}
          style={{ marginBottom: 4 }}
          items={[
            { key: 'active', label: `Active (${activeCount})` },
            { key: 'referral', label: `Referral Leads (${referralCount})` },
            { key: 'rejected', label: `Rejected (${rejectedCount})` },
            { key: 'archive', label: `Approved (${archiveCount})` },
          ]}
        />
      {viewMode === 'table' ? (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <Table size="small" rowKey="_id" loading={loading} dataSource={filtered} columns={columns} tableLayout="fixed" onRow={(row) => ({ onClick: () => navigate(`/admin/leads/${row._id}`), style: { cursor: 'pointer' } })} />
        </div>
      ) : (
        <Row gutter={[14, 14]}>
          {filtered.map((row) => {
            const statusMeta = STATUSES.find((x) => x.value === row.status);
            const productName = row.productType === 'credit_card' ? (row.cardProduct?.name || 'Credit Card') : (row.loanProduct?.name || 'Loan');
            return (
              <Col key={row._id} xs={24} sm={12} lg={8} xl={6}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => navigate(`/admin/leads/${row._id}`)}
                  className="lead-card"
                  style={{ borderRadius: 12, border: '1px solid #e0e2f7', cursor: 'pointer', height: '100%', boxShadow: '0 2px 12px rgba(99,102,241,0.10), 0 1px 3px rgba(99,102,241,0.06)', transition: 'all 0.2s ease' }}
                  styles={{ body: { padding: '14px 16px' } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Typography.Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 11 }}>{row.leadNumber || '—'}</Typography.Text>
                    <Tag color={statusMeta?.color}>{statusMeta?.label || row.status}</Tag>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 2 }}>{row.customerName}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>{row.phone}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{productName}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>{row.bank?.name || '—'}</div>
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{row.agent?.name || '—'}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#4f46e5' }}>AED {Number(row.commission || 0).toLocaleString()}</span>
                  </div>
                </Card>
              </Col>
            );
          })}
          {filtered.length === 0 && (
            <Col span={24}><div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>No leads found</div></Col>
          )}
        </Row>
      )}
    </>
  );
}

export default AdminLeads;
