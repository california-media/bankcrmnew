import { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Typography, Input, Select, DatePicker, Space, Button, Tabs, Tooltip, Popover, Card, Row, Col, ConfigProvider, Upload, Modal, Form, InputNumber, Popconfirm, message, Grid } from 'antd';
import { SearchOutlined, TableOutlined, AppstoreOutlined, UploadOutlined, DownloadOutlined, DeleteOutlined, CheckOutlined, CloseOutlined, DollarOutlined, EditOutlined } from '@ant-design/icons';

const { useBreakpoint } = Grid;
import dayjs from 'dayjs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLeadView } from '../../utils/leadViews';
import LeadViewBanner from '../../components/LeadViewBanner';
import api from '../../api/client';
import exportLeadsToExcel from '../../utils/exportLeadsExcel';
import downloadLeadImportTemplate from '../../utils/importLeadsTemplate';
import { LOAN_MILESTONES, ACTION_LABELS, getLoanActions } from '../../utils/loanActions';

const STATUSES = [
  { value: 'draft', label: 'Draft', color: 'default' },
  { value: 'submitted', label: 'Submitted', color: 'blue' },
  { value: 'under_review', label: 'Under Review', color: 'gold' },
  { value: 'assigned', label: 'Assigned', color: 'cyan' },
  { value: 'approved', label: 'Approved', color: 'green' },
  { value: 'rejected', label: 'Rejected', color: 'red' },
  { value: 'disbursed', label: 'Disbursed', color: 'purple' },
];

// Matches frontend/src/pages/agency/Leads.jsx's table convention — Reject
// is only offered pre-approval here; once a lead is Approved only Disburse
// remains in this table. (The lead detail page keeps full override.)
const REJECTABLE_FROM    = ['submitted', 'under_review', 'assigned'];
const LOAN_EDITABLE_FROM = ['submitted', 'under_review', 'assigned', 'approved'];

const PRODUCTS = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'loan', label: 'Loan' },
  { value: 'account', label: 'Account' },
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
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState();
  const [labelStatuses, setLabelStatuses] = useState([]);
  const [productFilter, setProductFilter] = useState();
  const [dateRange, setDateRange] = useState(null);

  const [bankFilter, setBankFilter] = useState();
  const [agencyFilter, setAgencyFilter] = useState();
  const [searchParams] = useSearchParams();
  const [agentFilter, setAgentFilter] = useState(searchParams.get('agent') || undefined);
  const [milestoneFilter, setMilestoneFilter] = useState();
  const { view, leadsTab, setLeadsTab, tabsActiveKey, clearView } = useLeadView();
  const [viewMode, setViewMode] = useState('table');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [statusModal, setStatusModal] = useState({ open: false, leadId: null, status: null, label: '' });
  const [statusNoteForm] = Form.useForm();
  const [statusSaving, setStatusSaving] = useState(false);
  const [actionModal, setActionModal] = useState({ open: false, leadId: null, type: null });
  const [actionForm] = Form.useForm();
  const [actionSaving, setActionSaving] = useState(false);
  const [empStatuses, setEmpStatuses] = useState([]);
  const [loanEditOpen, setLoanEditOpen] = useState(false);
  const [loanEditLead, setLoanEditLead] = useState(null);
  const [loanForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads');
      setLeads(data);
    } finally {
      setLoading(false);
    }
  };

  const deleteLead = async (id) => {
    try {
      await api.delete(`/leads/${id}/admin-delete`);
      message.success('Lead deleted');
      setLeads((prev) => prev.filter((l) => l._id !== id));
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed');
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
      message.success(`${ACTION_LABELS[actionModal.type] || 'Action'} marked done`);
      setActionModal({ open: false, leadId: null, type: null });
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActionSaving(false);
    }
  };

  useEffect(() => {
    load();
    api.get('/employee-statuses?statusType=lead_label').then((r) => setLabelStatuses(r.data.filter((s) => s.isActive))).catch(() => {});
    api.get('/employee-statuses?statusType=whatsapp_consent').then((r) => setEmpStatuses(r.data.filter((s) => s.isActive))).catch(() => {});
  }, []);

  const updateConsentStatus = async (leadId, consentStatusId) => {
    try {
      const { data } = await api.patch(`/leads/${leadId}/consent-status`, { consentStatusId: consentStatusId || null });
      setLeads((prev) => prev.map((l) => (l._id === leadId ? data : l)));
      message.success('Consent status updated');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update');
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

  const bulkUpdateStatus = async (status, label, eligibleFrom) => {
    const eligibleIds = selectedRowKeys.filter((id) => {
      const lead = leads.find((l) => l._id === id);
      return lead && eligibleFrom.includes(lead.status);
    });
    const skipped = selectedRowKeys.length - eligibleIds.length;
    if (!eligibleIds.length) {
      message.warning(`No selected lead(s) can be ${label.toLowerCase()}`);
      return;
    }
    const results = await Promise.allSettled(
      eligibleIds.map((id) => api.patch(`/leads/${id}/status`, { status }))
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    message.success(
      `${succeeded} lead(s) marked ${label}`
      + (failed ? `, ${failed} failed` : '')
      + (skipped ? `, ${skipped} skipped (not eligible)` : '')
    );
    setSelectedRowKeys([]);
    load();
  };

  // Same payment-locked guard as the single-row delete button (see
  // adminDeleteLead backend guard) — skip locked leads instead of failing.
  const isPaymentLocked = (l) => l.commissionStatus === 'paid' || ['agency_paid', 'received'].includes(l.agencyPaymentStatus);

  const bulkDelete = async () => {
    const eligibleIds = selectedRowKeys.filter((id) => {
      const lead = leads.find((l) => l._id === id);
      return lead && !isPaymentLocked(lead);
    });
    const skipped = selectedRowKeys.length - eligibleIds.length;
    if (!eligibleIds.length) {
      message.warning('No selected lead(s) can be deleted (all have a payment recorded)');
      return;
    }
    const results = await Promise.allSettled(
      eligibleIds.map((id) => api.delete(`/leads/${id}/admin-delete`))
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    message.success(
      `${succeeded} lead(s) deleted`
      + (failed ? `, ${failed} failed` : '')
      + (skipped ? `, ${skipped} skipped (payment recorded)` : '')
    );
    setSelectedRowKeys([]);
    load();
  };

  const bulkMilestoneAction = async (type, label) => {
    const results = await Promise.allSettled(
      selectedRowKeys.map((id) => api.patch(`/leads/${id}/${type}`, {}))
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    message.success(`${succeeded} lead(s) marked ${label}` + (failed ? `, ${failed} failed` : ''));
    setSelectedRowKeys([]);
    load();
  };

  const handleImportFile = async (file) => {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/leads/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(data);
      if (data.created > 0 || data.updated > 0) load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
    return false; // prevent antd Upload from trying to auto-upload itself
  };

  const activeCount = leads.filter(l => !['approved', 'disbursed', 'rejected'].includes(l.status) && !l.isReferral).length;
  const approvedCount = leads.filter(l => l.status === 'approved' && !l.isReferral).length;
  const rejectedCount = leads.filter(l => l.status === 'rejected').length;
  const archiveCount = leads.filter(l => l.status === 'disbursed').length;
  const referralCount = leads.filter(l => l.isReferral).length;

  const bankOptions = useMemo(() => {
    const seen = new Set();
    return leads
      .filter((l) => l.bank?._id && !seen.has(String(l.bank._id)) && seen.add(String(l.bank._id)))
      .map((l) => ({ value: String(l.bank._id), label: l.bank.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [leads]);

  const agencyOptions = useMemo(() => {
    const seen = new Set();
    return leads
      .filter((l) => l.agency?._id && !seen.has(String(l.agency._id)) && seen.add(String(l.agency._id)))
      .map((l) => ({ value: String(l.agency._id), label: l.agency.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [leads]);

  const agentOptions = useMemo(() => {
    const seen = new Set();
    return leads
      .filter((l) => l.agent?._id && !seen.has(String(l.agent._id)) && seen.add(String(l.agent._id)))
      .map((l) => ({ value: String(l.agent._id), label: l.agent.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const [from, to] = dateRange || [];
    return leads.filter((l) => {
      if (
        q &&
        !l.customerName.toLowerCase().includes(q) &&
        !String(l._id).toLowerCase().includes(q) &&
        !(l.leadNumber || '').toLowerCase().includes(q) &&
        !(l.referenceNo || '').toLowerCase().includes(q)
      ) return false;
      if (view) {
        if (!view.match(l)) return false;
      } else if (!q) {
        if (leadsTab === 'referral' && !l.isReferral) return false;
        if (leadsTab === 'approved' && (l.status !== 'approved' || l.isReferral)) return false;
        if (leadsTab === 'archive' && l.status !== 'disbursed') return false;
        if (leadsTab === 'rejected' && l.status !== 'rejected') return false;
        if (leadsTab === 'active' && (['approved', 'disbursed', 'rejected'].includes(l.status) || l.isReferral)) return false;
      }
      if (statusFilter && String(l.employeeStatus?._id) !== statusFilter) return false;
      if (productFilter && l.productType !== productFilter) return false;
      if (bankFilter && String(l.bank?._id) !== bankFilter) return false;
      if (agencyFilter && String(l.agency?._id) !== agencyFilter) return false;
      if (agentFilter && String(l.agent?._id) !== agentFilter) return false;
      if (from && dayjs(l.createdAt).isBefore(from.startOf('day'))) return false;
      if (to && dayjs(l.createdAt).isAfter(to.endOf('day'))) return false;
      if (milestoneFilter === 'approved' && l.status !== 'approved') return false;
      if (milestoneFilter === 'cpv' && !l.cpvDone) return false;
      if (milestoneFilter === 'activated' && !l.activateDone) return false;
      if (milestoneFilter === 'spent' && !l.spendDone) return false;
      return true;
    });
  }, [leads, search, statusFilter, productFilter, bankFilter, agencyFilter, agentFilter, dateRange, milestoneFilter, leadsTab, view]);

  const renderProduct = (row) => {
    const name = row.productType === 'credit_card' ? row.cardProduct?.name : row.productType === 'account' ? row.accountProduct?.name : row.loanProduct?.name;
    const sub = row.productType === 'credit_card'
      ? (row.cardProduct?.cardType === 'premium' ? 'Premium' : 'Regular')
      : row.productType === 'account'
        ? (row.accountProduct?.accountCategory === 'business' ? 'Business' : row.accountProduct?.accountCategory === 'savings' ? 'Savings' : 'Current')
        : (row.loanProduct?.loanCategory === 'mortgage' ? 'Mortgage' : row.loanProduct?.loanCategory === 'business' ? 'Business' : 'Personal');
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

  // Loan/account leads run the milestone chain from utils/loanActions.js
  // (Account Open, Car Registration, mortgage steps, etc). Same "X/Y
  // milestones" hover-pill pattern as frontend/src/pages/agency/Leads.jsx.
  const pill = (done, label) => done
    ? <span key={label} style={{ fontSize: 9, fontWeight: 700, color: '#15803d', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 999, padding: '0 5px', whiteSpace: 'nowrap' }}>{label} ✓</span>
    : <span key={label} style={{ fontSize: 9, fontWeight: 700, color: '#dc2626', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 999, padding: '0 5px', whiteSpace: 'nowrap' }}>{label} ✗</span>;

  const renderMilestoneBadges = (row) => {
    if (row.status !== 'approved' && row.status !== 'disbursed') return null;
    if (row.productType !== 'loan' && row.productType !== 'account') return null;
    const loanMilestones = LOAN_MILESTONES[row.accountType || row.loanType] || [];
    if (!loanMilestones.length) return null;
    const loanDoneCount = loanMilestones.filter((m) => row[m.field]).length;
    return (
      <div style={{ display: 'flex', gap: 3, marginTop: 3, flexWrap: 'nowrap' }}>
        <Popover
          content={<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{loanMilestones.map((m) => pill(row[m.field], ACTION_LABELS[m.type]))}</div>}
          trigger="hover"
        >
          <span style={{
            fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', borderRadius: 999, padding: '0 5px', cursor: 'default',
            color: loanDoneCount === loanMilestones.length ? '#15803d' : '#b45309',
            background: loanDoneCount === loanMilestones.length ? '#dcfce7' : '#fef3c7',
            border: `1px solid ${loanDoneCount === loanMilestones.length ? '#86efac' : '#fde68a'}`,
          }}>
            {loanDoneCount}/{loanMilestones.length} milestones
          </span>
        </Popover>
      </div>
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
      title: <ColHead>Reference No.</ColHead>,
      dataIndex: 'referenceNo',
      width: 110,
      render: (v) => v ? <span style={{ fontSize: 12 }}>{v}</span> : <span style={{ color: '#cbd5e1' }}>—</span>,
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
        const name = row.productType === 'credit_card' ? row.cardProduct?.name : row.productType === 'account' ? row.accountProduct?.name : row.loanProduct?.name;
        const fallback = row.productType === 'credit_card' ? 'Credit Card' : row.productType === 'account' ? 'Account' : 'Loan';
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
        if (['approved', 'disbursed', 'rejected'].includes(row.status)) return <div><StatusPill status={row.status} />{badges}{renderMilestoneBadges(row)}</div>;
        if (!row.employeeStatus) return <div><StatusPill status={row.status} />{badges}{renderMilestoneBadges(row)}</div>;
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
            {renderMilestoneBadges(row)}
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
        const COLOR = { paid: '#16a34a', payable: '#7C3AED', pending: '#d97706', none: '#7C3AED' };
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
    {
      title: <ColHead>Actions</ColHead>,
      width: 260,
      render: (_, row) => {
        const canApprove  = ['submitted', 'under_review', 'assigned'].includes(row.status);
        const canReject   = REJECTABLE_FROM.includes(row.status);
        const canEditLoan = row.productType === 'loan' && LOAN_EDITABLE_FROM.includes(row.status);
        // Matches agency/Leads.jsx — Disburse only appears once all required
        // milestones for this lead's product are actually done.
        let milestoneButtons = [];
        let canDisburse = false;
        if (row.status === 'approved') {
          if (row.productType === 'credit_card') {
            if (row.bank?.hasCpv !== false && !row.cpvDone) milestoneButtons.push({ type: 'cpv', label: 'CPV' });
            if (row.bank?.hasActivation !== false && !row.activateDone) milestoneButtons.push({ type: 'activate', label: 'Activated' });
            if (row.bank?.hasSpend && !row.spendDone) milestoneButtons.push({ type: 'spend', label: 'Spend' });
            canDisburse = (row.bank?.hasCpv === false || row.cpvDone) && (row.bank?.hasActivation === false || row.activateDone);
          } else if (row.productType === 'loan' || row.productType === 'account') {
            const loanActions = getLoanActions(row);
            milestoneButtons = loanActions.buttons;
            canDisburse = loanActions.canDisburse;
          }
        }
        // Matches the backend guard in adminDeleteLead — once real money has
        // moved for this lead, deleting it would erase that history from
        // every report that sums the Lead collection. Block it in the UI
        // too instead of letting the click round-trip to a server error.
        const paymentLocked = row.commissionStatus === 'paid' || ['agency_paid', 'received'].includes(row.agencyPaymentStatus);
        return (
          <Space size={4} wrap onClick={(e) => e.stopPropagation()}>
            {canApprove && <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => openStatusModal(row._id, 'approved', 'Approved')}>Approve</Button>}
            {milestoneButtons.map((b) => (
              <Button key={b.type} size="small" onClick={() => openActionModal(row._id, b.type)}>{b.label}</Button>
            ))}
            {canDisburse && <Button size="small" icon={<DollarOutlined />} onClick={() => openStatusModal(row._id, 'disbursed', 'Disbursed')}>Disburse</Button>}
            {canEditLoan && <Button size="small" icon={<EditOutlined />} onClick={() => openLoanEdit(row)} />}
            {canReject && <Button size="small" danger icon={<CloseOutlined />} onClick={() => openStatusModal(row._id, 'rejected', 'Rejected')}>Reject</Button>}
            {paymentLocked ? (
              <Tooltip title="This lead already has a payment recorded and cannot be deleted.">
                <Button size="small" danger disabled icon={<DeleteOutlined />} />
              </Tooltip>
            ) : (
              <Popconfirm
                title="Delete this lead?"
                description="This cannot be undone."
                onConfirm={() => deleteLead(row._id)}
                okText="Delete"
                okButtonProps={{ danger: true }}
                cancelText="Cancel"
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  const selectedLeads = leads.filter((l) => selectedRowKeys.includes(l._id));
  const canBulkApprove = selectedLeads.length > 0 && selectedLeads.every((l) => ['submitted', 'under_review', 'assigned'].includes(l.status));
  const canBulkReject = selectedLeads.length > 0 && selectedLeads.every((l) => REJECTABLE_FROM.includes(l.status));
  const canBulkCpv = selectedLeads.length > 0 && selectedLeads.every((l) => l.productType === 'credit_card' && l.status === 'approved' && l.bank?.hasCpv !== false && !l.cpvDone);
  const canBulkActivate = selectedLeads.length > 0 && selectedLeads.every((l) => l.productType === 'credit_card' && l.status === 'approved' && l.bank?.hasActivation !== false && !l.activateDone);
  const canBulkSpend = selectedLeads.length > 0 && selectedLeads.every((l) => l.productType === 'credit_card' && l.status === 'approved' && l.bank?.hasSpend && !l.spendDone);
  const canBulkDisburse = selectedLeads.length > 0 && selectedLeads.every((l) => {
    if (l.productType === 'credit_card') return l.status === 'approved' && (l.bank?.hasCpv === false || l.cpvDone) && (l.bank?.hasActivation === false || l.activateDone);
    if (l.productType === 'loan' || l.productType === 'account') return getLoanActions(l).canDisburse;
    return false;
  });

  return (
    <>
      <ConfigProvider theme={{ token: { borderRadius: 6 } }}>
      <div style={{ marginBottom: 16 }}>
        {/* Filter card: two evenly-filled rows, no dead space */}
        <div className="leads-filter-bar" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <Input
              allowClear
              placeholder="Search client or lead ID..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: isMobile ? '1 1 100%' : '1.6 1 200px', minWidth: 160 }}
            />
            <Select
              allowClear
              placeholder="All Stages"
              value={statusFilter}
              onChange={setStatusFilter}
              options={labelStatuses.map((s) => ({ value: String(s._id), label: s.label }))}
              style={{ flex: isMobile ? '1 1 calc(50% - 4px)' : '1 1 130px', minWidth: 110 }}
            />
            <Select
              allowClear
              placeholder="All Products"
              value={productFilter}
              onChange={setProductFilter}
              options={PRODUCTS}
              style={{ flex: isMobile ? '1 1 calc(50% - 4px)' : '1 1 130px', minWidth: 110 }}
            />
            <Select
              allowClear
              showSearch
              placeholder="All Banks"
              value={bankFilter}
              onChange={setBankFilter}
              options={bankOptions}
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
              style={{ flex: isMobile ? '1 1 100%' : '1 1 140px', minWidth: 120 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Select
              allowClear
              showSearch
              placeholder="All Agencies"
              value={agencyFilter}
              onChange={setAgencyFilter}
              options={agencyOptions}
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
              style={{ flex: isMobile ? '1 1 calc(50% - 4px)' : '1 1 140px', minWidth: 120 }}
            />
            <Select
              allowClear
              showSearch
              placeholder="All Agents"
              value={agentFilter}
              onChange={setAgentFilter}
              options={agentOptions}
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
              style={{ flex: isMobile ? '1 1 calc(50% - 4px)' : '1 1 140px', minWidth: 120 }}
            />
            <Select
              allowClear
              placeholder="All Milestones"
              value={milestoneFilter}
              onChange={setMilestoneFilter}
              options={[
                { value: 'approved', label: 'Approved' },
                { value: 'cpv', label: 'CPV Done' },
                { value: 'activated', label: 'Activated' },
                { value: 'spent', label: 'Spent' },
              ]}
              style={{ flex: isMobile ? '1 1 calc(50% - 4px)' : '1 1 140px', minWidth: 120 }}
            />
            {!isMobile && <DatePicker.RangePicker
              value={dateRange}
              onChange={setDateRange}
              allowClear
              style={{ flex: '1 1 210px', minWidth: 190 }}
            />}
            {(search || statusFilter || productFilter || bankFilter || agencyFilter || agentFilter || milestoneFilter || dateRange) && (
              <Button size="small" type="text" style={{ color: '#7C3AED', flexShrink: 0 }} onClick={() => { setSearch(''); setStatusFilter(undefined); setProductFilter(undefined); setBankFilter(undefined); setAgencyFilter(undefined); setAgentFilter(undefined); setMilestoneFilter(undefined); setDateRange(null); }}>
                Clear all
              </Button>
            )}
          </div>
        </div>
        {/* Toolbar: count, view toggle, template/import/export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Typography.Text type="secondary" style={{ whiteSpace: 'nowrap' }}>{filtered.length} shown</Typography.Text>
          <div style={{ flex: 1 }} />
          {!isMobile && (
            <Space size={6}>
              <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>Table</Button>
              <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} onClick={() => setViewMode('card')}>Cards</Button>
            </Space>
          )}
          <Space size={8}>
            <Button icon={<DownloadOutlined />} onClick={downloadLeadImportTemplate}>Template</Button>
            <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={handleImportFile}>
              <Button icon={<UploadOutlined />} loading={importing}>Import</Button>
            </Upload>
            <Button onClick={() => exportLeadsToExcel(filtered, { includeAgency: true })}>Export</Button>
          </Space>
        </div>
      </div>
      </ConfigProvider>

      <Modal
        title="Import Results"
        open={!!importResult}
        onCancel={() => setImportResult(null)}
        onOk={() => setImportResult(null)}
        footer={[<Button key="ok" type="primary" onClick={() => setImportResult(null)}>Close</Button>]}
      >
        {importResult && (
          <>
            <p>
              {importResult.created > 0 && <><strong>{importResult.created}</strong> lead(s) created. </>}
              {importResult.updated > 0 && <><strong>{importResult.updated}</strong> lead(s) updated. </>}
              <span style={{ color: '#64748b' }}>({importResult.total} row(s) total)</span>
            </p>
            {importResult.failed?.length > 0 && (
              <>
                <p style={{ color: '#dc2626', fontWeight: 600 }}>{importResult.failed.length} row(s) failed:</p>
                <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
                  {importResult.failed.map((f) => (
                    <div key={f.row} style={{ fontSize: 12, marginBottom: 4 }}>
                      <strong>Row {f.row}:</strong> {f.reason}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Modal>

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
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Mark ${ACTION_LABELS[actionModal.type] || ''} Done`}
        open={actionModal.open}
        onCancel={() => setActionModal({ open: false, leadId: null, type: null })}
        onOk={confirmAction}
        okText="Confirm"
        confirmLoading={actionSaving}
        destroyOnClose
      >
        <Form form={actionForm} layout="vertical">
          <Form.Item name="note" label="Note (optional)">
            <Input.TextArea rows={3} />
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
        width={440}
      >
        {loanEditLead && (
          <div style={{ display: 'flex', gap: 20, marginBottom: 18, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>Client</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', wordBreak: 'break-word' }}>{loanEditLead.customerName}</div>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>Product</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', wordBreak: 'break-word' }}>{loanEditLead.loanProduct?.name || '—'}</div>
            </div>
          </div>
        )}
        <Form form={loanForm} layout="vertical">
          <Form.Item name="loanAmount" label="Loan Amount (AED)" rules={[{ required: true, message: 'Loan amount is required' }]}>
            <InputNumber min={1} step={1000} style={{ width: '100%' }} prefix="AED" />
          </Form.Item>
        </Form>
      </Modal>

      {selectedRowKeys.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Space wrap>
            {leadsTab !== 'rejected' && canBulkApprove && (
              <Popconfirm
                title={`Approve ${selectedRowKeys.length} lead(s)?`}
                onConfirm={() => bulkUpdateStatus('approved', 'Approved', ['submitted', 'under_review', 'assigned'])}
              >
                <Button type="primary" style={{ background: '#16a34a', borderColor: '#16a34a' }}>
                  Approve {selectedRowKeys.length} lead(s)
                </Button>
              </Popconfirm>
            )}
            {leadsTab !== 'rejected' && canBulkReject && (
              <Popconfirm
                title={`Reject ${selectedRowKeys.length} lead(s)?`}
                onConfirm={() => bulkUpdateStatus('rejected', 'Rejected', REJECTABLE_FROM)}
              >
                <Button danger>Reject {selectedRowKeys.length} lead(s)</Button>
              </Popconfirm>
            )}
            {leadsTab !== 'rejected' && canBulkCpv && (
              <Popconfirm
                title={`Mark CPV done for ${selectedRowKeys.length} lead(s)?`}
                onConfirm={() => bulkMilestoneAction('cpv', 'CPV Done')}
              >
                <Button>CPV {selectedRowKeys.length} lead(s)</Button>
              </Popconfirm>
            )}
            {leadsTab !== 'rejected' && canBulkActivate && (
              <Popconfirm
                title={`Mark Activated for ${selectedRowKeys.length} lead(s)?`}
                onConfirm={() => bulkMilestoneAction('activate', 'Activated')}
              >
                <Button>Activate {selectedRowKeys.length} lead(s)</Button>
              </Popconfirm>
            )}
            {leadsTab !== 'rejected' && canBulkSpend && (
              <Popconfirm
                title={`Mark Spend done for ${selectedRowKeys.length} lead(s)?`}
                onConfirm={() => bulkMilestoneAction('spend', 'Spend Done')}
              >
                <Button>Spend {selectedRowKeys.length} lead(s)</Button>
              </Popconfirm>
            )}
            {leadsTab !== 'rejected' && canBulkDisburse && (
              <Popconfirm
                title={`Disburse ${selectedRowKeys.length} lead(s)?`}
                onConfirm={() => bulkUpdateStatus('disbursed', 'Disbursed', ['approved'])}
              >
                <Button type="primary" style={{ background: '#7e22ce', borderColor: '#7e22ce' }}>
                  Disburse {selectedRowKeys.length} lead(s)
                </Button>
              </Popconfirm>
            )}
            <Popconfirm
              title={`Delete ${selectedRowKeys.length} lead(s)?`}
              description="This cannot be undone. Leads with a payment already recorded will be skipped."
              onConfirm={bulkDelete}
              okText="Delete"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
            >
              <Button danger icon={<DeleteOutlined />}>Delete {selectedRowKeys.length} lead(s)</Button>
            </Popconfirm>
          </Space>
        </div>
      )}

        <LeadViewBanner view={view} count={filtered.length} onClear={clearView} />
        <Tabs
          activeKey={tabsActiveKey}
          onChange={setLeadsTab}
          style={{ marginBottom: 4 }}
          items={[
            { key: 'active', label: `Active (${activeCount})` },
            { key: 'referral', label: `Referral Leads (${referralCount})` },
            { key: 'approved', label: `Approved (${approvedCount})` },
            { key: 'archive', label: `Disbursed (${archiveCount})` },
            { key: 'rejected', label: `Rejected (${rejectedCount})` },
          ]}
        />
      {viewMode === 'table' && !isMobile ? (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <Table
            size="small"
            rowKey="_id"
            loading={loading}
            dataSource={filtered}
            columns={columns}
            tableLayout="fixed"
            scroll={{ x: 1300 }}
            rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
            onRow={(row) => ({ onClick: () => navigate(`/admin/leads/${row._id}`), style: { cursor: 'pointer' } })}
          />
        </div>
      ) : (
        <Row gutter={[14, 14]}>
          {filtered.map((row) => {
            const statusMeta = STATUSES.find((x) => x.value === row.status);
            const productName = row.productType === 'credit_card' ? (row.cardProduct?.name || 'Credit Card') : row.productType === 'account' ? (row.accountProduct?.name || 'Account') : (row.loanProduct?.name || 'Loan');
            return (
              <Col key={row._id} xs={24} sm={12} lg={8} xl={6}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => navigate(`/admin/leads/${row._id}`)}
                  className="lead-card"
                  style={{ borderRadius: 12, border: '1px solid #ede9fe', cursor: 'pointer', height: '100%', boxShadow: '0 2px 12px rgba(124,58,237,0.10), 0 1px 3px rgba(124,58,237,0.06)', transition: 'all 0.2s ease' }}
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
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#7C3AED' }}>AED {Number(row.commission || 0).toLocaleString()}</span>
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
