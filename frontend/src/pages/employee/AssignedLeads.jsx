import { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Typography, Input, Tabs, Select, message, Button, Space, Card, Row, Col, Modal, Form, Grid, Popover, InputNumber, Descriptions } from 'antd';
import { SearchOutlined, TableOutlined, AppstoreOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import api from '../../api/client';
import { ACTION_LABELS, LOAN_MILESTONES, getLoanActions } from '../../utils/loanActions';

const STATUSES = [
  { value: 'submitted', label: 'Submitted', color: 'blue' },
  { value: 'under_review', label: 'Under Review', color: 'gold' },
  { value: 'assigned', label: 'Assigned', color: 'cyan' },
  { value: 'approved', label: 'Approved', color: 'green' },
  { value: 'rejected', label: 'Rejected', color: 'red' },
  { value: 'disbursed', label: 'Disbursed', color: 'purple' },
];

const PRODUCT_LABELS = { credit_card: 'Credit Card', loan: 'Loan' };

const LOAN_EDITABLE_FROM = ['submitted', 'under_review', 'assigned', 'approved'];

const STATUS_PILL = {
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
    ? ` of AED ${Number(row.loanAmount).toLocaleString()}`
    : '';
  const msg = `Hi ${customer}, Inizio Global here on behalf of ${bank}. Please confirm you authorize us to process your ${product} application${amountPart}. Reply YES to consent or STOP to cancel.`;
  const phone = (row.phone || '').replace(/[^0-9]/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
};

const { useBreakpoint } = Grid;

const ENGAGEMENT_LABELS = {
  new_lead: 'New Lead',
  no_answer: 'No Answer',
  follow_up: 'Follow Up',
  focused_follow_up: 'Focused Follow Up',
  meeting_scheduled: 'Meeting Scheduled',
  not_interested: 'Not Interested',
  junk: 'Junk',
  pool: 'Pool',
  closed_deal: 'Closed Deal',
};

function AssignedLeads() {
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [leadsTab, setLeadsTab] = useState('active');
  const [empStatuses, setEmpStatuses] = useState([]);
  const [labelStatuses, setLabelStatuses] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [viewMode, setViewMode] = useState('table');

  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const empType   = user?.employeeType; // 'cpv' | 'sales' | undefined
  const showCpv   = empType === 'cpv';
  const showSales = empType === 'sales';

  const [actionModal, setActionModal] = useState({ open: false, leadId: null, type: null });
  const [actionForm] = Form.useForm();
  const [actionSaving, setActionSaving] = useState(false);

  const [statusModal, setStatusModal] = useState({ open: false, leadId: null, status: null, label: '' });
  const [statusNoteForm] = Form.useForm();
  const [statusSaving, setStatusSaving] = useState(false);

  const [loanEditOpen, setLoanEditOpen] = useState(false);
  const [loanEditLead, setLoanEditLead] = useState(null);
  const [loanForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads/assigned');
      setLeads(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get('/employee-statuses?statusType=whatsapp_consent').then((res) => setEmpStatuses(res.data.filter((s) => s.isActive)));
    api.get('/employee-statuses?statusType=lead_label').then(r => setLabelStatuses(r.data.filter(s => s.isActive))).catch(() => {});
  }, []);

  const updateEmpStatus = async (leadId, employeeStatusId) => {
    setUpdatingStatus(leadId);
    try {
      const { data } = await api.patch(`/leads/${leadId}/employee-status`, { employeeStatusId: employeeStatusId || null });
      setLeads((prev) => prev.map((l) => (l._id === leadId ? data : l)));
      message.success('Status updated');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const updateConsentStatus = async (leadId, consentStatusId) => {
    try {
      const { data } = await api.patch(`/leads/${leadId}/consent-status`, { consentStatusId: consentStatusId || null });
      setLeads((prev) => prev.map((l) => (l._id === leadId ? data : l)));
      message.success('Consent updated');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update');
    }
  };

  const openActionModal = (leadId, type) => {
    actionForm.resetFields();
    setActionModal({ open: true, leadId, type });
  };

  const openStatusModal = (leadId, status, label) => {
    statusNoteForm.resetFields();
    setStatusModal({ open: true, leadId, status, label });
  };

  const confirmStatusUpdate = async () => {
    setStatusSaving(true);
    try {
      const { note } = statusNoteForm.getFieldsValue();
      const { data } = await api.patch(`/leads/${statusModal.leadId}/status`, { status: statusModal.status, note: note || undefined });
      setLeads((prev) => prev.map((l) => (l._id === statusModal.leadId ? data : l)));
      message.success(`Marked as ${statusModal.label}`);
      setStatusModal({ open: false, leadId: null, status: null, label: '' });
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    } finally {
      setStatusSaving(false);
    }
  };

  const confirmAction = async () => {
    setActionSaving(true);
    try {
      const { note } = actionForm.getFieldsValue();
      const { data } = await api.patch(`/leads/${actionModal.leadId}/${actionModal.type}`, { note: note || undefined });
      setLeads((prev) => prev.map((l) => (l._id === actionModal.leadId ? data : l)));
      message.success(actionModal.type === 'cpv' ? 'CPV marked done' : 'Activated marked done');
      setActionModal({ open: false, leadId: null, type: null });
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
      const { data } = await api.patch(`/leads/${loanEditLead._id}/loan-amount`, { loanAmount });
      setLeads((prev) => prev.map((l) => (l._id === loanEditLead._id ? data : l)));
      message.success('Loan amount updated');
      setLoanEditOpen(false);
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  // Same status-progression rules the agency view uses (frontend/src/pages/agency/Leads.jsx):
  // credit-card leads go CPV/Activate/Spend -> Disburse, loan leads go through
  // getLoanActions()'s per-loanType milestone chain -> Disburse. CPV is a
  // credit-card-only step, so it's skipped entirely for loan leads.
  const buildActions = (row) => {
    const s = row.status;
    const isLoan = row.productType === 'loan';
    // Account leads (business_account/current_account/savings_account) run
    // through the same getLoanActions()-driven milestone chain as loans, so
    // the milestone gate covers both product types; loan-amount editing
    // stays loan-only since accounts have no loanAmount field.
    const hasMilestones = isLoan || row.productType === 'account';
    const loanActions = hasMilestones ? getLoanActions(row) : { buttons: [], canDisburse: false };
    const btns = [];
    if (showCpv && !hasMilestones && s === 'approved' && !row.cpvDone)
      btns.push({ key: 'cpv', label: 'CPV Done', onClick: () => openActionModal(row._id, 'cpv') });
    if (showSales) {
      if (['submitted', 'under_review', 'assigned'].includes(s))
        btns.push({ key: 'approve', label: 'Approve', type: 'primary', onClick: () => openStatusModal(row._id, 'approved', 'Approved') });
      if (hasMilestones) {
        loanActions.buttons.forEach((b) => btns.push({ key: b.type, label: b.label, onClick: () => openActionModal(row._id, b.type) }));
        if (loanActions.canDisburse) btns.push({ key: 'disburse', label: 'Disburse', onClick: () => openStatusModal(row._id, 'disbursed', 'Disbursed') });
        if (isLoan && LOAN_EDITABLE_FROM.includes(s)) btns.push({ key: 'edit-loan', icon: <EditOutlined />, onClick: () => openLoanEdit(row) });
      } else {
        if (s === 'approved' && !row.activateDone) btns.push({ key: 'activate', label: 'Activated', onClick: () => openActionModal(row._id, 'activate') });
        if (s === 'approved' && row.cpvDone && row.activateDone) btns.push({ key: 'disburse', label: 'Disburse', onClick: () => openStatusModal(row._id, 'disbursed', 'Disbursed') });
      }
      if (['submitted', 'under_review', 'assigned', 'approved'].includes(s))
        btns.push({ key: 'reject', label: 'Reject', danger: true, onClick: () => openStatusModal(row._id, 'rejected', 'Rejected') });
    }
    return btns;
  };

  const activeCount = leads.filter(l => l.status !== 'disbursed' && l.status !== 'rejected').length;
  const rejectedCount = leads.filter(l => l.status === 'rejected').length;
  const archiveCount = leads.filter(l => l.status === 'disbursed').length;

  const filtered = useMemo(() => {
    let result = leads;
    if (leadsTab === 'archive') {
      result = result.filter(l => l.status === 'disbursed');
    } else if (leadsTab === 'rejected') {
      result = result.filter(l => l.status === 'rejected');
    } else {
      result = result.filter(l => l.status !== 'disbursed' && l.status !== 'rejected');
    }
    const q = search.trim().toLowerCase();
    if (!q) return result;
    return result.filter(
      (l) =>
        l.customerName?.toLowerCase().includes(q) ||
        (l.leadNumber || '').toLowerCase().includes(q)
    );
  }, [leads, search, leadsTab]);

  const columns = [
    {
      title: <ColHead>Lead</ColHead>,
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
      dataIndex: 'productType',
      render: (v) => <span style={{ fontSize: 12, color: '#334155' }}>{PRODUCT_LABELS[v] || v}</span>,
    },
    {
      title: <ColHead>Bank</ColHead>,
      dataIndex: ['bank', 'name'],
      render: (v) => <span style={{ fontSize: 12, color: '#334155' }}>{v || '—'}</span>,
    },
    {
      title: <ColHead>Status</ColHead>,
      width: 120,
      render: (_, row) => {
        const COLOR_MAP = { blue: '#3b82f6', green: '#22c55e', gold: '#eab308', orange: '#f97316', red: '#ef4444', cyan: '#06b6d4', purple: '#a855f7', default: '#94a3b8', volcano: '#f97316' };
        const pill = (done, label) => done
          ? <span key={label} style={{ fontSize: 9, fontWeight: 700, color: '#15803d', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 999, padding: '0 5px', whiteSpace: 'nowrap' }}>{label} ✓</span>
          : <span key={label} style={{ fontSize: 9, fontWeight: 700, color: '#dc2626', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 999, padding: '0 5px', whiteSpace: 'nowrap' }}>{label} ✗</span>;
        const loanMilestones = LOAN_MILESTONES[row.accountType || row.loanType] || [];
        const loanDoneCount = loanMilestones.filter((m) => row[m.field]).length;
        const badges = (
          (row.status === 'approved' || row.status === 'disbursed') ? (
            <div style={{ display: 'flex', gap: 3, marginTop: 3, flexWrap: 'nowrap' }}>
              {row.productType === 'credit_card' ? (
                <>
                  {pill(row.cpvDone, 'CPV')}
                  {pill(row.activateDone, 'Activated')}
                  {row.bank?.hasSpend && pill(row.spendDone, 'Spend')}
                </>
              ) : loanMilestones.length > 0 ? (
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
              ) : null}
            </div>
          ) : null
        );
        if (['approved', 'disbursed', 'rejected'].includes(row.status)) return <div><StatusPill status={row.status} />{badges}</div>;
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
        return (
          <div>
            <StatusPill status={row.status} />
            {badges}
          </div>
        );
      },
    },
    {
      title: <ColHead>Consent</ColHead>,
      width: 140,
      render: (_, row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Select
            size="small"
            placeholder="Set consent"
            loading={updatingStatus === row._id}
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
      render: (v) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? relTime(v) : '—'}</span>,
    },
    {
      title: <ColHead>Actions</ColHead>,
      width: 240,
      render: (_, row) => {
        const btns = buildActions(row);
        if (!btns.length) return null;
        return (
          <Space size={4} wrap onClick={(e) => e.stopPropagation()}>
            {btns.map((b) => (
              <Button key={b.key} size="small" type={b.type} danger={b.danger} icon={b.icon} onClick={b.onClick}>{b.label}</Button>
            ))}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: 16, gap: isMobile ? 12 : 0 }}>
        <div>
          <Typography.Title level={4} style={{ margin: '0 0 4px', fontWeight: 500 }}>My Leads</Typography.Title>
          <Typography.Text type="secondary">Leads assigned to you.</Typography.Text>
        </div>
        {!isMobile && (
          <Space>
            <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>Table</Button>
            <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} onClick={() => setViewMode('card')}>Cards</Button>
          </Space>
        )}
      </div>

      <Input
        allowClear
        placeholder="Search client or lead ID..."
        prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: isMobile ? '100%' : 280, marginBottom: 16 }}
      />

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

      {viewMode === 'table' && !isMobile ? (
        <Table
          size="small"
          rowKey="_id"
          loading={loading}
          dataSource={filtered}
          columns={columns}
          onRow={(row) => ({
            onClick: () => navigate(`/employee/leads/${row._id}`),
            style: { cursor: 'pointer' },
          })}
        />
      ) : (
        <Row gutter={[14, 14]}>
          {filtered.map((row) => (
            <Col key={row._id} xs={24} sm={12} lg={8}>
              <Card
                size="small"
                hoverable
                onClick={() => navigate(`/employee/leads/${row._id}`)}
                style={{ borderRadius: 12, border: '1px solid #e2e8f0', cursor: 'pointer', height: '100%' }}
                styles={{ body: { padding: '14px 16px' } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{row.customerName}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{row.leadNumber || '—'}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{row.phone}</div>
                  </div>
                  <StatusPill status={row.status} />
                </div>
                <div style={{ fontSize: 12, color: '#334155', marginBottom: 4 }}>{PRODUCT_LABELS[row.productType] || row.productType}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>{row.bank?.name || '—'}</div>
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{row.updatedAt ? relTime(row.updatedAt) : '—'}</span>
                    {row.employeeStatus && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{row.employeeStatus.label}</span>
                    )}
                  </div>
                  {(() => {
                    const btns = buildActions(row);
                    if (!btns.length) return null;
                    return (
                      <Space size={4} wrap onClick={(e) => e.stopPropagation()} style={{ marginTop: 8 }}>
                        {btns.map((b) => (
                          <Button key={b.key} size="small" type={b.type} danger={b.danger} icon={b.icon} onClick={b.onClick}>{b.label}</Button>
                        ))}
                      </Space>
                    );
                  })()}
                </div>
              </Card>
            </Col>
          ))}
          {filtered.length === 0 && (
            <Col span={24}><div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>No leads found</div></Col>
          )}
        </Row>
      )}

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
            <Input.TextArea rows={3} placeholder="Add a note..." />
          </Form.Item>
        </Form>
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
            <Input.TextArea rows={3} placeholder="Add a note for this stage update..." />
          </Form.Item>
        </Form>
      </Modal>

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
    </>
  );
}

export default AssignedLeads;
