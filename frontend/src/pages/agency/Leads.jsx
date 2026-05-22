import { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Typography, Button, Input, Select, DatePicker, Row, Col, Space, message, Modal, Form, InputNumber, Descriptions, Tabs, Card, Empty, Tooltip } from 'antd';
import { SearchOutlined, CheckOutlined, CloseOutlined, EditOutlined, UserAddOutlined, TableOutlined, AppstoreOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

const STATUSES = [
  { value: 'submitted', label: 'New Lead', color: 'blue' },
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

const TERMINAL_STATUSES  = ['disbursed', 'rejected'];
const REJECTABLE_FROM    = ['submitted', 'under_review', 'assigned', 'approved'];
const LOAN_EDITABLE_FROM = ['submitted', 'under_review', 'assigned', 'approved'];

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const STATUS_PILL = {
  submitted:    { bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6', text: '#1d4ed8', label: 'NEW LEAD' },
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

const avatarBg = (name) => {
  const palette = ['#6366f1','#ec4899','#14b8a6','#f59e0b','#8b5cf6','#06b6d4','#10b981','#f43f5e'];
  let h = 0; for (const c of (name || '')) h = h * 31 + c.charCodeAt(0);
  return palette[Math.abs(h) % palette.length];
};
const initials = (name) => (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const ColHead = ({ children }) => (
  <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.8, textTransform: 'uppercase' }}>{children}</span>
);

const StatusPill = ({ status }) => {
  const p = STATUS_PILL[status] || { bg: '#f1f5f9', border: '#e2e8f0', dot: '#94a3b8', text: '#475569', label: status?.toUpperCase() };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: p.bg, border: `1px solid ${p.border}`, fontSize: 11, fontWeight: 700, color: p.text, whiteSpace: 'nowrap' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, flexShrink: 0 }} />
      {p.label}
    </span>
  );
};

const WaIcon = () => (
  <svg viewBox="0 0 32 32" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="15" fill="#fff"/>
    <path fill="#25D366" d="M22.9 9.1A9.77 9.77 0 0016 6.5C10.76 6.5 6.5 10.76 6.5 16c0 1.67.44 3.3 1.27 4.74L6.4 25.5l4.9-1.35A9.76 9.76 0 0016 25.5c5.24 0 9.5-4.26 9.5-9.5 0-2.54-.99-4.93-2.6-6.9zm-6.9 14.6c-1.42 0-2.8-.38-4.01-1.1l-.29-.17-2.9.8.78-2.84-.19-.3A7.85 7.85 0 018.35 16c0-4.22 3.43-7.65 7.65-7.65 2.04 0 3.96.8 5.4 2.24a7.62 7.62 0 012.25 5.42c0 4.22-3.43 7.65-7.65 7.65zm4.2-5.73c-.23-.12-1.36-.67-1.57-.75-.21-.08-.36-.12-.52.12-.15.23-.6.75-.73.9-.13.16-.27.17-.5.06a6.27 6.27 0 01-1.85-1.14 6.93 6.93 0 01-1.28-1.6c-.13-.23-.01-.35.1-.47.1-.1.23-.27.35-.4.11-.13.15-.23.23-.38.08-.15.04-.29-.02-.4-.06-.12-.52-1.25-.71-1.71-.19-.45-.38-.39-.52-.4h-.44c-.15 0-.4.06-.61.29-.21.23-.8.78-.8 1.91s.82 2.22.93 2.37c.12.16 1.62 2.48 3.94 3.48.55.24.98.38 1.31.48.55.18 1.05.15 1.45.09.44-.07 1.36-.56 1.55-1.1.19-.54.19-1 .13-1.1-.05-.1-.2-.15-.43-.27z"/>
  </svg>
);

const buildWhatsAppUrl = (row) => {
  const customer = row.customerName;
  const bank = row.bank?.name || 'the bank';
  const product = row.productType === 'credit_card'
    ? (row.cardProduct?.name || 'Credit Card')
    : (row.loanProduct?.name || 'Loan');
  const amountPart = row.productType === 'loan' && row.loanAmount
    ? ` of ${aed(row.loanAmount)}`
    : '';
  const msg = `Hi ${customer}, Inizio Global here on behalf of ${bank}. Please confirm you authorize us to process your ${product} application${amountPart}. Reply YES to consent or STOP to cancel.`;
  const phone = (row.phone || '').replace(/[^0-9]/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
};

function AgencyLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState();
  const [productFilter, setProductFilter] = useState();
  const [dateRange, setDateRange] = useState(null);
  const [leadsTab, setLeadsTab] = useState('active');

  // Status update modal
  const [statusModal, setStatusModal] = useState({ open: false, leadId: null, status: null, label: '' });
  const [statusNoteForm] = Form.useForm();
  const [statusSaving, setStatusSaving] = useState(false);

  // Loan amount edit modal
  const [loanEditOpen, setLoanEditOpen] = useState(false);
  const [loanEditLead, setLoanEditLead] = useState(null);
  const [loanForm] = Form.useForm();

  // CPV / Activate modals
  const [actionModal, setActionModal] = useState({ open: false, leadId: null, type: null }); // type: 'cpv' | 'activate'
  const [actionForm] = Form.useForm();
  const [actionSaving, setActionSaving] = useState(false);

  const [viewMode, setViewMode] = useState('table');

  // Bulk assign
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignForm] = Form.useForm();
  const [employees, setEmployees] = useState([]);
  const [assigningLead, setAssigningLead] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads/agency');
      setLeads(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get('/employees').then((res) => setEmployees(res.data)).catch(() => {});
  }, []);

  const bulkAssign = async () => {
    const { employeeId, type } = await bulkAssignForm.validateFields();
    try {
      const { data } = await api.post('/leads/bulk-assign-employee', { leadIds: selectedRowKeys, employeeId, type });
      message.success(`Assigned ${data.updated} lead(s)`);
      setSelectedRowKeys([]);
      setBulkAssignOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    }
  };

  const assignSingle = async (leadId, employeeId, type) => {
    setAssigningLead(`${leadId}-${type}`);
    try {
      await api.patch(`/leads/${leadId}/assign-employee`, { employeeId: employeeId || null, type });
      message.success(employeeId ? `${type === 'cpv' ? 'CPV' : 'Sales'} employee assigned` : 'Assignment cleared');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    } finally {
      setAssigningLead(null);
    }
  };

  const openStatusModal = (leadId, status, label) => {
    statusNoteForm.resetFields();
    setStatusModal({ open: true, leadId, status, label });
  };

  const confirmStatusUpdate = async () => {
    setStatusSaving(true);
    try {
      const { note } = statusNoteForm.getFieldsValue();
      await api.patch(`/leads/${statusModal.leadId}/status`, { status: statusModal.status, note: note || undefined });
      message.success(`Marked as ${statusModal.label}`);
      setStatusModal({ open: false, leadId: null, status: null, label: '' });
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    } finally {
      setStatusSaving(false);
    }
  };

  const openActionModal = (leadId, type) => {
    actionForm.resetFields();
    setActionModal({ open: true, leadId, type });
  };

  const confirmAction = async () => {
    setActionSaving(true);
    try {
      const { note } = actionForm.getFieldsValue();
      await api.patch(`/leads/${actionModal.leadId}/${actionModal.type}`, { note: note || undefined });
      message.success(actionModal.type === 'cpv' ? 'CPV marked done' : 'Activate marked done');
      setActionModal({ open: false, leadId: null, type: null });
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActionSaving(false);
    }
  };

  const openLoanEdit = (lead) => {
    setLoanEditLead(lead);
    loanForm.setFieldsValue({ loanAmount: lead.loanAmount });
    setLoanEditOpen(true);
  };

  const saveLoanAmount = async () => {
    const { loanAmount } = await loanForm.validateFields();
    try {
      await api.patch(`/leads/${loanEditLead._id}/loan-amount`, { loanAmount });
      message.success('Loan amount updated');
      setLoanEditOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  const activeCount = leads.filter(l => l.status !== 'disbursed' && l.status !== 'rejected').length;
  const rejectedCount = leads.filter(l => l.status === 'rejected').length;
  const archiveCount = leads.filter(l => l.status === 'disbursed').length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const [from, to] = dateRange || [];
    return leads.filter((l) => {
      if (leadsTab === 'archive' && l.status !== 'disbursed') return false;
      if (leadsTab === 'rejected' && l.status !== 'rejected') return false;
      if (leadsTab === 'active' && (l.status === 'disbursed' || l.status === 'rejected')) return false;
      if (q && !l.customerName.toLowerCase().includes(q) && !(l.leadNumber || '').toLowerCase().includes(q)) return false;
      if (statusFilter && l.status !== statusFilter) return false;
      if (productFilter && l.productType !== productFilter) return false;
      if (from && dayjs(l.createdAt).isBefore(from.startOf('day'))) return false;
      if (to && dayjs(l.createdAt).isAfter(to.endOf('day'))) return false;
      return true;
    });
  }, [leads, search, statusFilter, productFilter, dateRange, leadsTab]);

  const renderProduct = (row) => {
    if (row.productType === 'credit_card' && row.cardProduct) {
      const name = row.cardProduct.name;
      return (
        <div>
          <Typography.Text ellipsis={{ tooltip: name }} style={{ fontWeight: 600, fontSize: 11, display: 'block', maxWidth: 90 }}>{name}</Typography.Text>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>{row.cardProduct.cardType === 'premium' ? 'Premium' : 'Regular'}</span>
        </div>
      );
    }
    if (row.productType === 'loan' && row.loanProduct) {
      const name = row.loanProduct.name;
      return (
        <div>
          <Typography.Text ellipsis={{ tooltip: name }} style={{ fontWeight: 600, fontSize: 11, display: 'block', maxWidth: 90 }}>{name}</Typography.Text>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>{row.loanProduct.loanCategory === 'mortgage' ? 'Mortgage' : 'Personal'}</span>
        </div>
      );
    }
    return PRODUCTS.find((p) => p.value === row.productType)?.label || row.productType;
  };

  const columns = [
    {
      title: <ColHead>Lead</ColHead>,
      width: 185,
      render: (_, row) => (
        <div style={{ lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{row.customerName}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{row.leadNumber || '—'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{row.phone}</span>
            {row.phone && (
              <a href={buildWhatsAppUrl(row)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, lineHeight: 0 }}
                title="WhatsApp consent"><WaIcon /></a>
            )}
          </div>
        </div>
      ),
    },
    {
      title: <ColHead>Product</ColHead>,
      width: 105,
      render: (_, row) => (
        <div style={{ maxWidth: 100 }}>{renderProduct(row)}</div>
      ),
    },
    {
      title: <ColHead>Bank</ColHead>,
      dataIndex: ['bank', 'name'],
      width: 80,
      render: (v) => <span style={{ fontSize: 12, color: '#334155' }}>{v || '—'}</span>,
    },
    {
      title: <ColHead>Status</ColHead>,
      dataIndex: 'status',
      width: 120,
      render: (s) => <StatusPill status={s} />,
    },
    {
      title: <ColHead>Consent</ColHead>,
      width: 120,
      render: (_, row) => {
        if (!row.employeeStatus) return <span style={{ color: '#cbd5e1', fontSize: 13 }}>—</span>;
        const COLOR_MAP = { blue: '#3b82f6', green: '#22c55e', gold: '#eab308', orange: '#f97316', red: '#ef4444', cyan: '#06b6d4', purple: '#a855f7', default: '#94a3b8', volcano: '#f97316' };
        const c = COLOR_MAP[row.employeeStatus.color] || '#94a3b8';
        return (
          <Tooltip title={row.employeeStatus.label}>
            <span style={{ display: 'inline-block', maxWidth: 100, padding: '3px 8px', borderRadius: 999, border: `1.5px solid ${c}`, fontSize: 10, fontWeight: 700, color: c, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.employeeStatus.label}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: <ColHead>Agent</ColHead>,
      width: 120,
      render: (_, row) => {
        const emp = row.assignedSalesEmployee || row.assignedCpvEmployee || row.assignedEmployee;
        if (!emp) return <span style={{ color: '#cbd5e1', fontSize: 13 }}>—</span>;
        const name = emp.name || emp.email;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarBg(name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
              {initials(name)}
            </div>
            <span style={{ fontSize: 12, color: '#334155', fontWeight: 500 }}>{name.split(' ')[0]}</span>
          </div>
        );
      },
    },
    {
      title: <ColHead>Actions</ColHead>,
      width: 110,
      render: (_, row) => {
        const canReject   = REJECTABLE_FROM.includes(row.status);
        const canEditLoan = row.productType === 'loan' && LOAN_EDITABLE_FROM.includes(row.status);
        const canApprove  = ['submitted', 'under_review', 'assigned'].includes(row.status);
        const canCpv      = row.status === 'approved' && !row.cpvDone;
        const canActivate = row.status === 'approved' && !row.activateDone;
        const canDisburse = row.status === 'approved' && row.cpvDone && row.activateDone;
        const hasActions  = canApprove || canCpv || canActivate || canDisburse || canEditLoan || canReject;
        if (!hasActions) return null;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }} onClick={(e) => e.stopPropagation()}>
            {canApprove && (
              <span onClick={() => openStatusModal(row._id, 'approved', 'Approved')} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: '#dcfce7', border: '1px solid #86efac', color: '#15803d', fontSize: 11, fontWeight: 700 }}>
                <CheckOutlined style={{ fontSize: 9 }} /> Approve
              </span>
            )}
            {canCpv && (
              <span onClick={() => openActionModal(row._id, 'cpv')} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: '#dbeafe', border: '1px solid #93c5fd', color: '#1d4ed8', fontSize: 11, fontWeight: 700 }}>
                CPV
              </span>
            )}
            {canActivate && (
              <span onClick={() => openActionModal(row._id, 'activate')} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: '#ccfbf1', border: '1px solid #5eead4', color: '#0f766e', fontSize: 11, fontWeight: 700 }}>
                Activate
              </span>
            )}
            {canDisburse && (
              <span onClick={() => openStatusModal(row._id, 'disbursed', 'Disbursed')} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: '#ede9fe', border: '1px solid #c4b5fd', color: '#6d28d9', fontSize: 11, fontWeight: 700 }}>
                Disburse
              </span>
            )}
            {canEditLoan && (
              <span onClick={() => openLoanEdit(row)} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: '3px 7px', borderRadius: 999, background: '#fef9c3', border: '1px solid #fde047', color: '#a16207', fontSize: 11 }}>
                <EditOutlined style={{ fontSize: 10 }} />
              </span>
            )}
            {canReject && (
              <span onClick={() => openStatusModal(row._id, 'rejected', 'Rejected')} style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: '3px 7px', borderRadius: 999, background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 11 }}>
                <CloseOutlined style={{ fontSize: 9 }} />
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: <ColHead>Updated</ColHead>,
      dataIndex: 'updatedAt',
      width: 80,
      render: (v) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? relTime(v) : '—'}</span>,
    },
    {
      title: <ColHead>Payout</ColHead>,
      width: 95,
      align: 'right',
      render: (_, row) => (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: row.commissionStatus === 'paid' ? '#16a34a' : '#4f46e5' }}>{aed(row.commission)}</div>
          {row.commissionStatus === 'paid' && <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>PAID</div>}
        </div>
      ),
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Typography.Title level={4} style={{ margin: 0, fontWeight: 500 }}>Lead Queue</Typography.Title>
          <Typography.Text type="secondary">
            Leads filed to your agency. Approve is only enabled once a lead reaches <i>Assigned</i>; reject is available throughout.
          </Typography.Text>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<TableOutlined />}
              type={viewMode === 'table' ? 'primary' : 'default'}
              onClick={() => setViewMode('table')}
            >Table</Button>
            <Button
              icon={<AppstoreOutlined />}
              type={viewMode === 'card' ? 'primary' : 'default'}
              onClick={() => setViewMode('card')}
            >Cards</Button>
          </Space>
        </Col>
      </Row>

      <Space wrap style={{ margin: '10px 0 8px', width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Input
            allowClear
            placeholder="Search client or lead ID..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <Select
            allowClear
            placeholder="All Stages"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            style={{ width: 180 }}
          />
          <Select
            allowClear
            placeholder="All Products"
            value={productFilter}
            onChange={setProductFilter}
            options={PRODUCTS}
            style={{ width: 180 }}
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={setDateRange}
            allowClear
            style={{ width: 240 }}
          />
          {(search || statusFilter || productFilter || dateRange) && (
            <Button onClick={() => { setSearch(''); setStatusFilter(undefined); setProductFilter(undefined); setDateRange(null); }}>
              Clear Filters
            </Button>
          )}
        </Space>
        <Typography.Text type="secondary">{filtered.length} leads</Typography.Text>
      </Space>

      {selectedRowKeys.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => { bulkAssignForm.resetFields(); setBulkAssignOpen(true); }}>
            Assign {selectedRowKeys.length} lead(s) to Employee
          </Button>
        </div>
      )}

      <Tabs
        activeKey={leadsTab}
        onChange={setLeadsTab}
        style={{ marginBottom: 8 }}
        items={[
          { key: 'active', label: `Active (${activeCount})` },
          { key: 'rejected', label: `Rejected (${rejectedCount})` },
          { key: 'archive', label: `Approved (${archiveCount})` },
        ]}
      />

      {viewMode === 'table' ? (
        <Table
          size="small"
          rowKey="_id"
          loading={loading}
          dataSource={filtered}
          columns={columns}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          onRow={(row) => ({ onClick: () => navigate(`/agency/leads/${row._id}`), style: { cursor: 'pointer' } })}
          pagination={{ pageSize: 15, showSizeChanger: false }}
        />
      ) : (
        <Row gutter={[14, 14]}>
          {filtered.map((row) => {
            const statusMeta = STATUSES.find((x) => x.value === row.status);
            const canAssign = !TERMINAL_STATUSES.includes(row.status);
            return (
              <Col key={row._id} xs={24} sm={12} lg={8} xl={6}>
                <div
                  onClick={() => navigate(`/agency/leads/${row._id}`)}
                  style={{ cursor: 'pointer', height: '100%' }}
                >
                  <Card
                    size="small"
                    hoverable
                    style={{ borderRadius: 12, border: '1px solid #e2e8f0', height: '100%' }}
                    styles={{ body: { padding: '14px 16px' } }}
                  >
                    {/* Header: Lead ID + Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <Typography.Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                        {row.leadNumber || '—'}
                      </Typography.Text>
                      <Tag color={statusMeta?.color} style={{ margin: 0 }}>{statusMeta?.label || row.status}</Tag>
                    </div>

                    {/* Customer */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', lineHeight: 1.3 }}>{row.customerName}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{row.phone}</span>
                        {row.phone && (
                          <a
                            href={buildWhatsAppUrl(row)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, lineHeight: 0 }}
                          >
                            <WaIcon />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Product + Bank */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{renderProduct(row)}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{row.bank?.name || '—'}</div>
                    </div>

                    {/* Employee status */}
                    {row.employeeStatus && (
                      <div style={{ marginBottom: 8 }}>
                        <Tag color={row.employeeStatus.color} style={{ fontSize: 11 }}>{row.employeeStatus.label}</Tag>
                      </div>
                    )}

                    {/* Assign dropdowns */}
                    {canAssign && (
                      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8 }}>
                        <Select size="small" allowClear placeholder="CPV employee"
                          loading={assigningLead === `${row._id}-cpv`}
                          value={row.assignedCpvEmployee?._id || undefined}
                          onChange={(val) => assignSingle(row._id, val || null, 'cpv')}
                          style={{ width: '100%', marginBottom: 6 }}
                          options={employees.filter((e) => e.isActive && e.employeeType === 'cpv').map((e) => ({ value: e._id, label: e.name || e.email }))}
                        />
                        <Select size="small" allowClear placeholder="Sales employee"
                          loading={assigningLead === `${row._id}-sales`}
                          value={row.assignedSalesEmployee?._id || undefined}
                          onChange={(val) => assignSingle(row._id, val || null, 'sales')}
                          style={{ width: '100%' }}
                          options={employees.filter((e) => e.isActive && e.employeeType === 'sales').map((e) => ({ value: e._id, label: e.name || e.email }))}
                        />
                      </div>
                    )}
                    {!canAssign && (row.assignedCpvEmployee || row.assignedSalesEmployee) && (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                        {row.assignedCpvEmployee && <div>CPV: {row.assignedCpvEmployee.name || row.assignedCpvEmployee.email}</div>}
                        {row.assignedSalesEmployee && <div>Sales: {row.assignedSalesEmployee.name || row.assignedSalesEmployee.email}</div>}
                      </div>
                    )}

                    {/* Actions */}
                    {(() => {
                      const canReject   = REJECTABLE_FROM.includes(row.status);
                      const canEditLoan = row.productType === 'loan' && LOAN_EDITABLE_FROM.includes(row.status);
                      const canApprove  = ['submitted', 'under_review', 'assigned'].includes(row.status);
                      const canCpv      = row.status === 'approved' && !row.cpvDone;
                      const canActivate = row.status === 'approved' && !row.activateDone;
                      const canDisburse = row.status === 'approved' && row.cpvDone && row.activateDone;
                      if (!canApprove && !canCpv && !canActivate && !canDisburse && !canEditLoan && !canReject) return null;
                      return (
                        <Space size={4} style={{ marginTop: 10, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                          {canApprove && (
                            <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => openStatusModal(row._id, 'approved', 'Approved')}>Approve</Button>
                          )}
                          {canCpv && (
                            <Button size="small" onClick={() => openActionModal(row._id, 'cpv')}>CPV</Button>
                          )}
                          {canActivate && (
                            <Button size="small" onClick={() => openActionModal(row._id, 'activate')}>Activate</Button>
                          )}
                          {canDisburse && (
                            <Button size="small" onClick={() => openStatusModal(row._id, 'disbursed', 'Disbursed')}>Disburse</Button>
                          )}
                          {canEditLoan && (
                            <Button size="small" icon={<EditOutlined />} onClick={() => openLoanEdit(row)} />
                          )}
                          {canReject && (
                            <Button size="small" danger icon={<CloseOutlined />} onClick={() => openStatusModal(row._id, 'rejected', 'Rejected')}>Reject</Button>
                          )}
                        </Space>
                      );
                    })()}
                  </Card>
                </div>
              </Col>
            );
          })}
          {filtered.length === 0 && (
            <Col span={24}><Empty description="No leads found" /></Col>
          )}
        </Row>
      )}

      {/* Status update modal */}
      <Modal
        title={`Move to: ${statusModal.label}`}
        open={statusModal.open}
        onCancel={() => setStatusModal({ open: false, leadId: null, status: null, label: '' })}
        onOk={confirmStatusUpdate}
        okText="Confirm"
        confirmLoading={statusSaving}
        destroyOnClose
      >
        <Form form={statusNoteForm} layout="vertical">
          <Form.Item name="note" label="Note (optional)">
            <Input.TextArea rows={3} placeholder="Add a note for this stage update..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Loan amount modal */}
      <Modal
        title="Edit Loan Amount"
        open={loanEditOpen}
        onCancel={() => setLoanEditOpen(false)}
        onOk={saveLoanAmount}
        okText="Save"
        destroyOnClose
      >
        {loanEditLead && (
          <Descriptions size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Client">{loanEditLead.customerName}</Descriptions.Item>
            <Descriptions.Item label="Product">{loanEditLead.loanProduct?.name}</Descriptions.Item>
          </Descriptions>
        )}
        <Form form={loanForm} layout="vertical">
          <Form.Item name="loanAmount" label="Loan Amount (AED)" rules={[{ required: true, message: 'Loan amount is required' }]}>
            <InputNumber min={1} step={1000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* CPV / Activate modal */}
      <Modal
        title={actionModal.type === 'cpv' ? 'Mark CPV Done' : 'Mark Activate Done'}
        open={actionModal.open}
        onCancel={() => setActionModal({ open: false, leadId: null, type: null })}
        onOk={confirmAction}
        okText="Confirm"
        confirmLoading={actionSaving}
        destroyOnClose
      >
        <Form form={actionForm} layout="vertical">
          <Form.Item name="note" label="Note (optional)">
            <Input.TextArea rows={3} placeholder="Add a note..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Bulk assign modal */}
      <Modal
        title={`Assign ${selectedRowKeys.length} Lead(s) to Employee`}
        open={bulkAssignOpen}
        onCancel={() => setBulkAssignOpen(false)}
        onOk={bulkAssign}
        okText="Assign"
        destroyOnClose
      >
        <Form form={bulkAssignForm} layout="vertical" initialValues={{ type: 'cpv' }}>
          <Form.Item name="type" label="Employee Type" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'cpv', label: 'CPV Employee' },
                { value: 'sales', label: 'Sales Employee' },
              ]}
              onChange={() => bulkAssignForm.setFieldValue('employeeId', undefined)}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              const opts = employees
                .filter((e) => e.isActive && e.employeeType === type)
                .map((e) => ({ value: e._id, label: e.name || e.email }));
              return (
                <Form.Item name="employeeId" label="Employee" rules={[{ required: true, message: 'Select an employee' }]}>
                  <Select
                    placeholder="Select employee"
                    options={opts}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default AgencyLeads;
