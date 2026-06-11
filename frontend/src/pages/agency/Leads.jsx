import { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Typography, Button, Input, Select, DatePicker, Row, Col, Space, message, Modal, Form, InputNumber, Descriptions, Tabs } from 'antd';
import { SearchOutlined, EditOutlined, UserAddOutlined, TableOutlined, AppstoreOutlined } from '@ant-design/icons';
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
const LOAN_EDITABLE_FROM = ['submitted', 'under_review', 'assigned', 'approved'];
const REJECTABLE_FROM    = ['submitted', 'under_review', 'assigned', 'approved'];

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
  const [employeeFilter, setEmployeeFilter] = useState();
  const [dateRange, setDateRange] = useState(null);
  const [leadsTab, setLeadsTab] = useState('active');

  // Status update modal
  const [statusModal, setStatusModal] = useState({ open: false, leadId: null, status: null, label: '' });
  const [statusNoteForm] = Form.useForm();
  const [statusSaving, setStatusSaving] = useState(false);

  // CPV / Activate modals
  const [actionModal, setActionModal] = useState({ open: false, leadId: null, type: null });
  const [actionForm] = Form.useForm();
  const [actionSaving, setActionSaving] = useState(false);

  // Loan amount edit modal
  const [loanEditOpen, setLoanEditOpen] = useState(false);
  const [loanEditLead, setLoanEditLead] = useState(null);
  const [loanForm] = Form.useForm();

  const [viewMode, setViewMode] = useState('table');
  const [empStatuses, setEmpStatuses] = useState([]);
  const [labelStatuses, setLabelStatuses] = useState([]);

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
    api.get('/employee-statuses?statusType=whatsapp_consent').then((res) => setEmpStatuses(res.data.filter((s) => s.isActive))).catch(() => {});
    api.get('/employee-statuses?statusType=lead_label').then((res) => setLabelStatuses(res.data.filter((s) => s.isActive))).catch(() => {});
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

  const updateEmpStatus = async (leadId, employeeStatusId) => {
    try {
      const { data } = await api.patch(`/leads/${leadId}/employee-status`, { employeeStatusId: employeeStatusId || null });
      setLeads((prev) => prev.map((l) => (l._id === leadId ? data : l)));
      message.success('Status updated');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update');
    }
  };

  const updateConsentStatus = async (leadId, consentStatusId) => {
    try {
      const { data } = await api.patch(`/leads/${leadId}/consent-status`, { consentStatusId: consentStatusId || null });
      setLeads((prev) => prev.map((l) => (l._id === leadId ? data : l)));
      message.success('Consent status updated');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update');
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
      message.success(actionModal.type === 'cpv' ? 'CPV marked done' : 'Activated marked done');
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
      if (statusFilter && String(l.employeeStatus?._id) !== statusFilter) return false;
      if (productFilter && l.productType !== productFilter) return false;
      if (employeeFilter) {
        const emp = l.assignedSalesEmployee || l.assignedCpvEmployee || l.assignedEmployee;
        if (!emp || String(emp._id) !== employeeFilter) return false;
      }
      if (from && dayjs(l.createdAt).isBefore(from.startOf('day'))) return false;
      if (to && dayjs(l.createdAt).isAfter(to.endOf('day'))) return false;
      return true;
    });
  }, [leads, search, statusFilter, productFilter, employeeFilter, dateRange, leadsTab]);

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
      width: 140,
      render: (_, row) => {
        const COLOR_MAP = { blue: '#3b82f6', green: '#22c55e', gold: '#eab308', orange: '#f97316', red: '#ef4444', cyan: '#06b6d4', purple: '#a855f7', default: '#94a3b8', volcano: '#f97316' };
        const badges = (
          (row.cpvDone || row.activateDone) ? (
            <div style={{ display: 'flex', gap: 3, marginTop: 3, flexWrap: 'nowrap' }}>
              {row.cpvDone && <span style={{ fontSize: 9, fontWeight: 700, color: '#15803d', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 999, padding: '0 5px', whiteSpace: 'nowrap' }}>CPV ✓</span>}
              {row.activateDone && <span style={{ fontSize: 9, fontWeight: 700, color: '#15803d', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 999, padding: '0 5px', whiteSpace: 'nowrap' }}>Activated ✓</span>}
            </div>
          ) : null
        );
        // Post-approval: always show system status pill
        if (['approved', 'disbursed'].includes(row.status)) {
          const p = STATUS_PILL[row.status] || { bg: '#f1f5f9', border: '#e2e8f0', dot: '#94a3b8', text: '#475569', label: (row.status || '').toUpperCase() };
          return (
            <div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: p.bg, border: `1px solid ${p.border}`, fontSize: 11, fontWeight: 700, color: p.text, whiteSpace: 'nowrap' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, flexShrink: 0 }} />
                {p.label}
              </span>
              {badges}
            </div>
          );
        }
        // Pre-approval: custom label pill if set
        if (row.employeeStatus) {
          const c = COLOR_MAP[row.employeeStatus.color] || '#94a3b8';
          return (
            <div>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, border: `1.5px solid ${c}`, fontSize: 11, fontWeight: 700, color: c, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {row.employeeStatus.label}
              </span>
              {badges}
            </div>
          );
        }
        const p = STATUS_PILL[row.status] || { bg: '#f1f5f9', border: '#e2e8f0', dot: '#94a3b8', text: '#475569', label: (row.status || '').toUpperCase() };
        return (
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: p.bg, border: `1px solid ${p.border}`, fontSize: 11, fontWeight: 700, color: p.text, whiteSpace: 'nowrap' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.dot, flexShrink: 0 }} />
              {p.label}
            </span>
            {badges}
          </div>
        );
      },
    },
    {
      title: <ColHead>Consent</ColHead>,
      width: 130,
      render: (_, row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Select
            size="small"
            placeholder="Set consent"
            value={row.consentStatus?._id ? String(row.consentStatus._id) : undefined}
            onChange={(val) => updateConsentStatus(row._id, val)}
            style={{ width: '100%' }}
            options={empStatuses.map((s) => ({
              value: String(s._id),
              label: <Tag color={s.color} style={{ margin: 0 }}>{s.label}</Tag>,
            }))}
          />
        </div>
      ),
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
      title: <ColHead>Updated</ColHead>,
      dataIndex: 'updatedAt',
      width: 80,
      render: (v) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? relTime(v) : '—'}</span>,
    },
    {
      title: <ColHead>Payout</ColHead>,
      width: 110,
      align: 'right',
      render: (_, row) => (
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: row.commissionStatus === 'paid' ? '#16a34a' : '#4f46e5' }}>{aed(row.grossCommission)}</div>
          {row.commissionStatus === 'paid' && <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>PAID</div>}
        </div>
      ),
    },
    {
      title: <ColHead>Actions</ColHead>,
      width: 200,
      render: (_, row) => {
        const canReject   = REJECTABLE_FROM.includes(row.status);
        const canEditLoan = row.productType === 'loan' && LOAN_EDITABLE_FROM.includes(row.status);
        const canApprove  = ['submitted', 'under_review', 'assigned'].includes(row.status);
        const canCpv      = row.status === 'approved' && !row.cpvDone;
        const canActivate = row.status === 'approved' && !row.activateDone;
        const canDisburse = row.status === 'approved' && row.cpvDone && row.activateDone;
        if (!canApprove && !canCpv && !canActivate && !canDisburse && !canEditLoan && !canReject) return null;
        return (
          <Space size={4} wrap onClick={(e) => e.stopPropagation()}>
            {canApprove && <Button size="small" type="primary" onClick={() => openStatusModal(row._id, 'approved', 'Approved')}>Approve</Button>}
            {canCpv && <Button size="small" onClick={() => openActionModal(row._id, 'cpv')}>CPV</Button>}
            {canActivate && <Button size="small" onClick={() => openActionModal(row._id, 'activate')}>Activated</Button>}
            {canDisburse && <Button size="small" onClick={() => openStatusModal(row._id, 'disbursed', 'Disbursed')}>Disburse</Button>}
            {canEditLoan && <Button size="small" icon={<EditOutlined />} onClick={() => openLoanEdit(row)} />}
            {canReject && <Button size="small" danger onClick={() => openStatusModal(row._id, 'rejected', 'Rejected')}>Reject</Button>}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Lead Queue</h2>
        <Space>
          <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>Table</Button>
          <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} onClick={() => setViewMode('card')}>Cards</Button>
        </Space>
      </div>

      <div className="leads-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Input
          allowClear
          placeholder="Search client or lead ID..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 260, flexShrink: 0, borderRadius: 6 }}
        />
        <Select
          allowClear
          placeholder="All Stages"
          value={statusFilter}
          onChange={setStatusFilter}
          options={labelStatuses.map((s) => ({ value: String(s._id), label: s.label }))}
          style={{ width: 160, flexShrink: 0, borderRadius: 6 }}
        />
        <Select
          allowClear
          placeholder="All Products"
          value={productFilter}
          onChange={setProductFilter}
          options={PRODUCTS}
          style={{ width: 160, flexShrink: 0, borderRadius: 6 }}
        />
        <Select
          allowClear
          showSearch
          placeholder="All Employees"
          value={employeeFilter}
          onChange={setEmployeeFilter}
          options={employees.filter(e => e.isActive).map(e => ({ value: String(e._id), label: e.name || e.email }))}
          filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
          style={{ width: 180, flexShrink: 0, borderRadius: 6 }}
        />
        <DatePicker.RangePicker
          value={dateRange}
          onChange={setDateRange}
          allowClear
          style={{ width: 230, flexShrink: 0, borderRadius: 6 }}
        />
        {(search || statusFilter || productFilter || employeeFilter || dateRange) && (
          <Button size="small" type="text" style={{ color: '#6366f1' }} onClick={() => { setSearch(''); setStatusFilter(undefined); setProductFilter(undefined); setEmployeeFilter(undefined); setDateRange(null); }}>
            Clear
          </Button>
        )}
      </div>

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
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
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
        </div>
      ) : (
        <Row gutter={[14, 14]}>
          {filtered.map((row) => {
            const statusMeta = STATUSES.find((x) => x.value === row.status);
            return (
              <Col key={row._id} xs={24} sm={12} lg={8}>
                <div
                  className="lead-card"
                  onClick={() => navigate(`/agency/leads/${row._id}`)}
                  style={{
                    cursor: 'pointer', height: '100%', borderRadius: 14,
                    border: '1px solid #e0e2f7', background: '#fafbff',
                    padding: '14px 16px',
                    boxShadow: '0 2px 12px rgba(99,102,241,0.07), 0 1px 3px rgba(99,102,241,0.04)',
                    transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                  }}
                >
                    {/* Header: Lead ID + Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>
                        {row.leadNumber || '—'}
                      </span>
                      <Tag color={statusMeta?.color} style={{ margin: 0, fontSize: 10 }}>{statusMeta?.label || row.status}</Tag>
                    </div>

                    {/* Customer */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', lineHeight: 1.3 }}>{row.customerName}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{row.phone}</span>
                        {row.phone && (
                          <a href={buildWhatsAppUrl(row)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, lineHeight: 0 }}>
                            <WaIcon />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Product + Bank */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{renderProduct(row)}</div>
                      {row.bank?.name && (
                        <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 500, color: '#4f46e5', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 999, padding: '1px 8px', marginTop: 4 }}>
                          {row.bank.name}
                        </span>
                      )}
                    </div>

                    {/* Employee status */}
                    {row.employeeStatus && (
                      <div style={{ marginBottom: 6 }}>
                        <Tag color={row.employeeStatus.color} style={{ fontSize: 11 }}>{row.employeeStatus.label}</Tag>
                      </div>
                    )}

                    {/* Assigned employees (read-only pills) */}
                    {(row.assignedCpvEmployee || row.assignedSalesEmployee) && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                        {row.assignedCpvEmployee && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 999, padding: '1px 7px' }}>
                            CPV: {row.assignedCpvEmployee.name || row.assignedCpvEmployee.email}
                          </span>
                        )}
                        {row.assignedSalesEmployee && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: '#7e22ce', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 999, padding: '1px 7px' }}>
                            Sales: {row.assignedSalesEmployee.name || row.assignedSalesEmployee.email}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Footer: time + actions */}
                    {(() => {
                      const canReject   = REJECTABLE_FROM.includes(row.status);
                      const canEditLoan = row.productType === 'loan' && LOAN_EDITABLE_FROM.includes(row.status);
                      const canApprove  = ['submitted', 'under_review', 'assigned'].includes(row.status);
                      const canCpv      = row.status === 'approved' && !row.cpvDone;
                      const canActivate = row.status === 'approved' && !row.activateDone;
                      const canDisburse = row.status === 'approved' && row.cpvDone && row.activateDone;
                      const hasActions  = canApprove || canCpv || canActivate || canDisburse || canEditLoan || canReject;
                      return (
                        <div style={{ borderTop: '1px solid #f0f0f8', paddingTop: 8, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>{relTime(row.updatedAt || row.createdAt)}</span>
                          {hasActions && (
                            <Space size={4} onClick={(e) => e.stopPropagation()}>
                              {canApprove && <Button size="small" type="primary" onClick={() => openStatusModal(row._id, 'approved', 'Approved')}>Approve</Button>}
                              {canCpv && <Button size="small" onClick={() => openActionModal(row._id, 'cpv')}>CPV</Button>}
                              {canActivate && <Button size="small" onClick={() => openActionModal(row._id, 'activate')}>Activate</Button>}
                              {canDisburse && <Button size="small" onClick={() => openStatusModal(row._id, 'disbursed', 'Disbursed')}>Disburse</Button>}
                              {canEditLoan && <Button size="small" icon={<EditOutlined />} onClick={() => openLoanEdit(row)} />}
                              {canReject && <Button size="small" danger onClick={() => openStatusModal(row._id, 'rejected', 'Rejected')}>Reject</Button>}
                            </Space>
                          )}
                        </div>
                      );
                    })()}
                </div>
              </Col>
            );
          })}
          {filtered.length === 0 && (
            <Col span={24}><div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>No leads found</div></Col>
          )}
        </Row>
      )}

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

      {/* CPV / Activate modal */}
      <Modal
        title={actionModal.type === 'cpv' ? 'Mark CPV Done' : 'Mark Activated Done'}
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
