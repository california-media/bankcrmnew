import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Card, Col, Row, Typography, Tag, Space, Button, Descriptions, Skeleton,
  Timeline, Divider, message, Modal, Form, InputNumber, Input, Select, Image, Tabs,
} from 'antd';
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, FileOutlined, DollarOutlined,
} from '@ant-design/icons';
import api from '../../api/client';

const STATUSES = {
  draft:           { color: 'default',  label: 'Draft' },
  submitted:       { color: 'blue',     label: 'Submitted' },
  under_review:    { color: 'gold',     label: 'Under Review' },
  assigned:        { color: 'cyan',     label: 'Assigned' },
  approved:        { color: 'green',    label: 'Approved' },
  rejected:        { color: 'red',      label: 'Rejected' },
  disbursed:       { color: 'purple',   label: 'Disbursed' },
  cpv_done:        { color: 'teal',     label: 'CPV Done' },
  activate_done:   { color: 'lime',     label: 'Activate Done' },
  employee_status: { color: 'orange',   label: 'Employee Status' },
};

const AGENCY_STATUSES = {
  ...STATUSES,
  submitted: { color: 'blue', label: 'New Lead' },
};

const COMM_COLORS = { paid: 'green', payable: 'cyan', pending: 'gold', none: 'default' };
const COMM_LABELS = { paid: 'Paid', payable: 'Payout Ready', pending: 'Pending', none: '—' };

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;
const pct = (n) => `${Number(n || 0)}%`;

const REJECTABLE_FROM    = ['submitted', 'under_review', 'assigned', 'approved'];
const LOAN_EDITABLE_FROM = ['submitted', 'under_review', 'assigned', 'approved'];

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const VISA_LABELS = { employment: 'Employment', residence: 'Residence', investor: 'Investor', golden: 'Golden', freelance: 'Freelance', tourist: 'Tourist', other: 'Other' };

const InfoItem = ({ label, value, sub }) => {
  if (value == null || value === '' || value === false) return null;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#334155', fontWeight: 500, wordBreak: 'break-word' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{sub}</div>}
    </div>
  );
};

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const role = user.role;

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);

  const [loanOpen, setLoanOpen]       = useState(false);
  const [statusModal, setStatusModal] = useState({ open: false, status: null, label: '' });
  const [loanForm]                    = Form.useForm();
  const [statusNoteForm]              = Form.useForm();
  const [statusSaving, setStatusSaving] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [assigningEmployee, setAssigningEmployee] = useState(null);

  const [actionModal, setActionModal] = useState({ open: false, type: null });
  const [actionForm] = Form.useForm();
  const [actionSaving, setActionSaving] = useState(false);

  const [labelStatuses, setLabelStatuses] = useState([]);
  const [consentStatuses, setConsentStatuses] = useState([]);
  const [empStatusSaving, setEmpStatusSaving] = useState(false);
  const [consentStatusSaving, setConsentStatusSaving] = useState(false);
  const [benefitsOpen, setBenefitsOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/leads/${id}`);
      setLead(data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Lead not found');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (role === 'agency') {
      api.get('/employees').then((res) => setEmployees(res.data)).catch(() => {});
    }
    if (role === 'employee' || role === 'agency') {
      api.get('/employee-statuses?statusType=lead_label').then((res) => setLabelStatuses(res.data.filter((s) => s.isActive))).catch(() => {});
      api.get('/employee-statuses?statusType=whatsapp_consent').then((res) => setConsentStatuses(res.data.filter((s) => s.isActive))).catch(() => {});
    }
  }, [role]);

  const openStatusModal = (status, label) => {
    statusNoteForm.resetFields();
    setStatusModal({ open: true, status, label });
  };

  const confirmStatusUpdate = async () => {
    setStatusSaving(true);
    try {
      const { note } = statusNoteForm.getFieldsValue();
      await api.patch(`/leads/${id}/status`, { status: statusModal.status, note: note || undefined });
      message.success(`Marked as ${statusModal.label}`);
      setStatusModal({ open: false, status: null, label: '' });
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    } finally {
      setStatusSaving(false);
    }
  };

  const saveLoanAmount = async () => {
    const { loanAmount } = await loanForm.validateFields();
    try {
      await api.patch(`/leads/${id}/loan-amount`, { loanAmount });
      message.success('Loan amount updated');
      setLoanOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  const assignEmployee = async (employeeId, type) => {
    setAssigningEmployee(type);
    try {
      const { data } = await api.patch(`/leads/${id}/assign-employee`, { employeeId: employeeId || null, type });
      setLead(data);
      message.success(employeeId ? `${type === 'cpv' ? 'CPV' : 'Sales'} employee assigned` : 'Assignment cleared');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to assign');
    } finally {
      setAssigningEmployee(null);
    }
  };

  const confirmAction = async () => {
    setActionSaving(true);
    try {
      const { note } = actionForm.getFieldsValue();
      const { data } = await api.patch(`/leads/${id}/${actionModal.type}`, { note: note || undefined });
      setLead(data);
      message.success(actionModal.type === 'cpv' ? 'CPV marked done' : 'Activated marked done');
      setActionModal({ open: false, type: null });
    } catch (err) {
      message.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActionSaving(false);
    }
  };

  const updateEmpStatus = async (employeeStatusId) => {
    setEmpStatusSaving(true);
    try {
      const { data } = await api.patch(`/leads/${id}/employee-status`, { employeeStatusId: employeeStatusId || null });
      setLead(data);
      message.success('Status updated');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setEmpStatusSaving(false);
    }
  };

  const updateConsentStatus = async (consentStatusId) => {
    setConsentStatusSaving(true);
    try {
      const { data } = await api.patch(`/leads/${id}/consent-status`, { consentStatusId: consentStatusId || null });
      setLead(data);
      message.success('Consent status updated');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update consent status');
    } finally {
      setConsentStatusSaving(false);
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setNoteSubmitting(true);
    try {
      const { data } = await api.post(`/leads/${id}/notes`, { text: noteText.trim() });
      setLead(data);
      setNoteText('');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to add note');
    } finally {
      setNoteSubmitting(false);
    }
  };

  const deleteNote = async (noteId) => {
    setDeletingNoteId(noteId);
    try {
      const { data } = await api.delete(`/leads/${id}/notes/${noteId}`);
      setLead(data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete note');
    } finally {
      setDeletingNoteId(null);
    }
  };

  const backPath = role === 'admin' ? '/admin/leads' : role === 'agency' ? '/agency/leads' : role === 'employee' ? '/employee/leads' : '/agent/leads';

  if (loading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }

  if (!lead) return null;

  const statusMap = role === 'agency' ? AGENCY_STATUSES : STATUSES;
  const statusMeta = statusMap[lead.status] || { color: 'default', label: lead.status };
  const isLoan = lead.productType === 'loan';
  const product = isLoan ? lead.loanProduct : lead.cardProduct;

  const cardStyle = { borderRadius: 12, marginBottom: 12 };
  const cardBodyStyle = { padding: '14px 16px' };
  const sectionLabel = (text) => (
    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.7 }}>{text}</span>
  );

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <Space size={8} wrap>
          <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => navigate(backPath)}>Back</Button>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', fontFamily: 'monospace' }}>
            {lead.leadNumber || `LD-${String(lead._id).slice(-6)}`}
          </span>
          <Tag color={statusMeta.color} style={{ margin: 0 }}>{statusMeta.label}</Tag>
          {lead.cpvDone && <Tag color="green" style={{ margin: 0 }}>CPV ✓</Tag>}
          {lead.activateDone && <Tag color="green" style={{ margin: 0 }}>Activated ✓</Tag>}
          {role !== 'employee' && lead.commissionStatus !== 'none' && (
            <Tag color={COMM_COLORS[lead.commissionStatus]} style={{ margin: 0 }}>{COMM_LABELS[lead.commissionStatus]}</Tag>
          )}
        </Space>
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Created {new Date(lead.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
          {' · '}Updated {new Date(lead.updatedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
        </Typography.Text>
      </div>

      <Row gutter={[12, 12]}>
        {/* LEFT COLUMN */}
        <Col xs={24} lg={16}>

          {/* Customer */}
          <Card size="small" style={cardStyle} styles={{ body: cardBodyStyle }}>
            <div style={{ marginBottom: 10 }}>
              {sectionLabel('Customer')}
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginTop: 4 }}>{lead.customerName}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px 16px' }}>
              {lead.phone && <InfoItem label="Phone" value={lead.phone} />}
              {lead.email && <InfoItem label="Email" value={lead.email} />}
              {lead.customerSalary > 0 && <InfoItem label="Monthly Salary" value={aed(lead.customerSalary)} />}
              {lead.nationality && <InfoItem label="Nationality" value={lead.nationality} />}
              {lead.visaType && <InfoItem label="Visa Type" value={VISA_LABELS[lead.visaType] || lead.visaType} />}
              {lead.companyName && <InfoItem label="Company" value={lead.companyName} />}
              {lead.jobTitle && <InfoItem label="Job Title" value={lead.jobTitle} />}
              {lead.yearsOfExperience != null && lead.yearsOfExperience >= 0 && (
                <InfoItem label="Experience" value={`${lead.yearsOfExperience} yr${lead.yearsOfExperience !== 1 ? 's' : ''}`} />
              )}
            </div>
          </Card>

          {/* People (admin) */}
          {role === 'admin' && (
            <Card size="small" style={cardStyle} styles={{ body: cardBodyStyle }}>
              <div style={{ marginBottom: 10 }}>{sectionLabel('People')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px 16px' }}>
                <InfoItem label="Agent" value={lead.agent?.name || lead.agent?.email || '—'} sub={lead.agent?.name && lead.agent?.email ? lead.agent.email : undefined} />
                <InfoItem label="Agency" value={lead.agency?.name || lead.agency?.email || '—'} sub={lead.agency?.name && lead.agency?.email ? lead.agency.email : undefined} />
                {lead.assignedCpvEmployee && (
                  <InfoItem label="CPV Employee" value={lead.assignedCpvEmployee.name || lead.assignedCpvEmployee.email} sub={lead.assignedCpvEmployee.name && lead.assignedCpvEmployee.email ? lead.assignedCpvEmployee.email : undefined} />
                )}
                {lead.assignedSalesEmployee && (
                  <InfoItem label="Sales Employee" value={lead.assignedSalesEmployee.name || lead.assignedSalesEmployee.email} sub={lead.assignedSalesEmployee.name && lead.assignedSalesEmployee.email ? lead.assignedSalesEmployee.email : undefined} />
                )}
              </div>
            </Card>
          )}

          {/* Disbursement Receipt */}
          {role !== 'agent' && (lead.status === 'disbursed' || lead.disbursementReceipt || lead.disbursementReceiptFile) && (
            <Card size="small" title={sectionLabel('Disbursement Receipt')} style={cardStyle} styles={{ body: cardBodyStyle }}>
              {lead.disbursementReceipt || lead.disbursementReceiptFile ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px 16px' }}>
                  {lead.disbursementReceipt && (
                    <InfoItem label="Reference No." value={<span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{lead.disbursementReceipt}</span>} />
                  )}
                  {lead.disbursementReceiptFile && (
                    <InfoItem label="File" value={<a href={`${API_BASE}/uploads/receipts/${lead.disbursementReceiptFile}`} target="_blank" rel="noreferrer"><FileOutlined /> View / Download</a>} />
                  )}
                  {lead.disbursementReceiptAt && (
                    <InfoItem label="Submitted" value={new Date(lead.disbursementReceiptAt).toLocaleString()} />
                  )}
                </div>
              ) : (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>No receipt submitted yet.</Typography.Text>
              )}
            </Card>
          )}

          {/* Status History */}
          {lead.statusHistory?.length > 0 && (
            <Card size="small" title={sectionLabel('Status History')} style={cardStyle} styles={{ body: { padding: '8px 16px' } }}>
              <div style={{ maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
                <Timeline
                  style={{ marginTop: 8 }}
                  items={[...lead.statusHistory].reverse().map((h) => {
                    const meta = statusMap[h.status] || { color: 'default', label: h.status };
                    return {
                      color: meta.color === 'default' ? 'gray' : meta.color,
                      children: (
                        <div style={{ paddingBottom: 2 }}>
                          <Tag color={meta.color} style={{ margin: 0, marginBottom: 2, fontSize: 11 }}>{meta.label}</Tag>
                          {h.note && <div style={{ fontSize: 12, color: '#444', marginTop: 2 }}>{h.note}</div>}
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                            {new Date(h.changedAt).toLocaleString()}
                            {role !== 'agent' && h.changedBy && ` · ${h.changedBy.name || h.changedBy.email}`}
                          </div>
                        </div>
                      ),
                    };
                  })}
                />
              </div>
            </Card>
          )}

          {/* Notes */}
          <Card size="small" title={sectionLabel('Notes')} style={cardStyle} styles={{ body: cardBodyStyle }}>
            {lead.notes && (
              <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>Submission Note</div>
                <div style={{ fontSize: 12, color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{lead.notes}</div>
              </div>
            )}
            {(lead.leadNotes ?? []).length > 0 ? (
              <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 10, paddingRight: 2 }}>
                {lead.leadNotes.map((n) => {
                  const hiddenFromViewer = (n.authorRole === 'admin' && role !== 'admin') || (n.authorRole === 'agency' && role === 'agent');
                  const employeeAnonymised = n.authorRole === 'employee' && role === 'agent';
                  const authorDisplay = hiddenFromViewer ? 'Staff' : employeeAnonymised ? (n.author?.employeeId || 'Staff') : (n.author?.name || n.author?.email || 'Unknown');
                  return (
                    <div key={n._id} style={{ padding: '10px 12px', borderRadius: 8, background: '#f8fafc', border: '1px solid #f1f5f9', marginBottom: 6, position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 12 }}>{authorDisplay}</span>
                        {!hiddenFromViewer && <Tag style={{ fontSize: 10, lineHeight: '16px', padding: '0 5px', margin: 0 }}>{n.authorRole}</Tag>}
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(n.createdAt).toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#333', whiteSpace: 'pre-wrap' }}>{n.text}</div>
                      {role === 'admin' && (
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} loading={deletingNoteId === n._id} style={{ position: 'absolute', top: 6, right: 6 }} onClick={() => deleteNote(n._id)} />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>No notes yet.</Typography.Text>
            )}
            <Input.TextArea rows={2} placeholder="Add a note..." value={noteText} onChange={(e) => setNoteText(e.target.value)} style={{ marginBottom: 6, fontSize: 12 }} />
            <Button size="small" type="primary" loading={noteSubmitting} disabled={!noteText.trim()} onClick={addNote}>Add Note</Button>
          </Card>

          {/* Payout History */}
          {lead.payoutHistory?.length > 0 && (
            <Card size="small" title={sectionLabel('Payout History')} style={cardStyle} styles={{ body: { padding: '8px 16px' } }}>
              <Timeline
                style={{ marginTop: 8 }}
                items={[...lead.payoutHistory].reverse().map((p) => ({
                  color: 'green',
                  children: (
                    <div>
                      <strong style={{ fontSize: 13 }}>{aed(p.amount)}</strong>
                      <div style={{ fontSize: 11, color: '#888' }}>
                        {new Date(p.sentAt).toLocaleString()}
                        {p.month && ` · ${p.month}`}
                        {p.sentBy && ` · by ${p.sentBy.name || p.sentBy.email}`}
                      </div>
                    </div>
                  ),
                }))}
              />
            </Card>
          )}
        </Col>

        {/* RIGHT COLUMN */}
        <Col xs={24} lg={8}>

          {/* Benefits & Fees Modal */}
          <Modal
            title={isLoan ? lead.loanProduct?.name : lead.cardProduct?.name}
            open={benefitsOpen}
            onCancel={() => setBenefitsOpen(false)}
            footer={null}
            width={640}
            destroyOnClose
          >
            <Tabs
              defaultActiveKey={product?.benefits ? 'benefits' : 'fees'}
              items={[
                ...(product?.benefits ? [{
                  key: 'benefits',
                  label: 'Product Benefits',
                  children: (
                    <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.8, maxHeight: 480, overflowY: 'auto', paddingRight: 4 }} dangerouslySetInnerHTML={{ __html: product.benefits }} />
                  ),
                }] : []),
                ...(product?.feesEligibility ? [{
                  key: 'fees',
                  label: 'Fees & Eligibility',
                  children: (
                    <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.8, maxHeight: 480, overflowY: 'auto', paddingRight: 4 }} dangerouslySetInnerHTML={{ __html: product.feesEligibility }} />
                  ),
                }] : []),
              ]}
            />
          </Modal>

          {/* Agency Actions */}
          {role === 'agency' && (
            <Card size="small" title={sectionLabel('Actions')} style={cardStyle} styles={{ body: cardBodyStyle }}>
              {(lead.assignedCpvEmployee || lead.assignedSalesEmployee) && (
                <div style={{ display: 'flex', gap: 16, marginBottom: 10, padding: '8px 10px', background: '#f0f7ff', borderRadius: 8 }}>
                  {lead.assignedCpvEmployee && (
                    <div>
                      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>CPV</div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{lead.assignedCpvEmployee.name || lead.assignedCpvEmployee.email}</div>
                    </div>
                  )}
                  {lead.assignedSalesEmployee && (
                    <div>
                      <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Sales</div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{lead.assignedSalesEmployee.name || lead.assignedSalesEmployee.email}</div>
                    </div>
                  )}
                </div>
              )}
              {(lead.cpvDone || lead.activateDone) && (
                <Space style={{ marginBottom: 10, flexWrap: 'wrap' }}>
                  {lead.cpvDone && <Tag color="green" style={{ margin: 0 }}>CPV ✓</Tag>}
                  {lead.activateDone && <Tag color="green" style={{ margin: 0 }}>Activated ✓</Tag>}
                </Space>
              )}
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                {['submitted', 'under_review', 'assigned'].includes(lead.status) && (
                  <Button block size="small" type="primary" icon={<CheckOutlined />} onClick={() => openStatusModal('approved', 'Approved')}>Approve</Button>
                )}
                {lead.status === 'approved' && !lead.cpvDone && (
                  <Button block size="small" onClick={() => { actionForm.resetFields(); setActionModal({ open: true, type: 'cpv' }); }}>CPV</Button>
                )}
                {lead.status === 'approved' && !lead.activateDone && (
                  <Button block size="small" onClick={() => { actionForm.resetFields(); setActionModal({ open: true, type: 'activate' }); }}>Activated</Button>
                )}
                {lead.status === 'approved' && lead.cpvDone && lead.activateDone && (
                  <Button block size="small" onClick={() => openStatusModal('disbursed', 'Disbursed')}>Mark Disbursed</Button>
                )}
                {isLoan && LOAN_EDITABLE_FROM.includes(lead.status) && (
                  <Button block size="small" icon={<EditOutlined />} onClick={() => { loanForm.setFieldsValue({ loanAmount: lead.loanAmount }); setLoanOpen(true); }}>Edit Loan Amount</Button>
                )}
                {REJECTABLE_FROM.includes(lead.status) && (
                  <Button block size="small" danger icon={<CloseOutlined />} onClick={() => openStatusModal('rejected', 'Rejected')}>Reject</Button>
                )}
                {!['disbursed', 'rejected'].includes(lead.status) && (
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Assign Employees</div>
                    <Select allowClear placeholder="CPV employee" loading={assigningEmployee === 'cpv'} value={lead.assignedCpvEmployee?._id || undefined} onChange={(val) => assignEmployee(val || null, 'cpv')} size="small" style={{ width: '100%', marginBottom: 4 }} options={employees.filter((e) => e.isActive && e.employeeType === 'cpv').map((e) => ({ value: e._id, label: e.name || e.email }))} />
                    <Select allowClear placeholder="Sales employee" loading={assigningEmployee === 'sales'} value={lead.assignedSalesEmployee?._id || undefined} onChange={(val) => assignEmployee(val || null, 'sales')} size="small" style={{ width: '100%' }} options={employees.filter((e) => e.isActive && e.employeeType === 'sales').map((e) => ({ value: e._id, label: e.name || e.email }))} />
                  </div>
                )}
              </Space>
            </Card>
          )}

          {/* Employee Actions */}
          {role === 'employee' && (() => {
            const et = user.employeeType;
            return (
              <Card size="small" title={sectionLabel('Actions')} style={cardStyle} styles={{ body: cardBodyStyle }}>
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  {(lead.cpvDone || lead.activateDone) && (
                    <Space style={{ flexWrap: 'wrap' }}>
                      {lead.cpvDone && <Tag color="green" style={{ margin: 0 }}>CPV ✓</Tag>}
                      {lead.activateDone && <Tag color="green" style={{ margin: 0 }}>Activated ✓</Tag>}
                    </Space>
                  )}
                  {et === 'cpv' && lead.status === 'approved' && !lead.cpvDone && (
                    <Button block size="small" onClick={() => { actionForm.resetFields(); setActionModal({ open: true, type: 'cpv' }); }}>Mark CPV Done</Button>
                  )}
                  {et === 'sales' && ['submitted', 'under_review', 'assigned'].includes(lead.status) && (
                    <Button block size="small" type="primary" icon={<CheckOutlined />} onClick={() => openStatusModal('approved', 'Approved')}>Approve</Button>
                  )}
                  {et === 'sales' && lead.status === 'approved' && !lead.activateDone && (
                    <Button block size="small" onClick={() => { actionForm.resetFields(); setActionModal({ open: true, type: 'activate' }); }}>Mark Activated</Button>
                  )}
                  {et === 'sales' && lead.status === 'approved' && lead.cpvDone && lead.activateDone && (
                    <Button block size="small" style={{ background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' }} icon={<DollarOutlined />} onClick={() => openStatusModal('disbursed', 'Disbursed')}>Mark Disbursed</Button>
                  )}
                  {et === 'sales' && ['submitted', 'under_review', 'assigned', 'approved'].includes(lead.status) && (
                    <Button block size="small" danger icon={<CloseOutlined />} onClick={() => openStatusModal('rejected', 'Rejected')}>Reject</Button>
                  )}
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Status Label</div>
                    <Select placeholder="Set status..." value={lead.employeeStatus?._id || lead.employeeStatus || undefined} loading={empStatusSaving} onChange={(val) => updateEmpStatus(val || null)} size="small" style={{ width: '100%' }} options={labelStatuses.map((s) => ({ value: s._id, label: <Tag color={s.color}>{s.label}</Tag> }))} />
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Consent</div>
                    <Select placeholder="Set consent..." value={lead.consentStatus?._id || lead.consentStatus || undefined} loading={consentStatusSaving} onChange={(val) => updateConsentStatus(val || null)} size="small" style={{ width: '100%' }} options={consentStatuses.map((s) => ({ value: s._id, label: <Tag color={s.color}>{s.label}</Tag> }))} />
                  </div>
                </Space>
              </Card>
            );
          })()}

          {/* Agency status/consent */}
          {role === 'agency' && (
            <>
              {['submitted', 'under_review', 'assigned'].includes(lead.status) && (
                <Card size="small" title={sectionLabel('Status')} style={cardStyle} styles={{ body: cardBodyStyle }}>
                  <Select placeholder="Set stage..." value={lead.employeeStatus?._id || lead.employeeStatus || undefined} loading={empStatusSaving} onChange={(val) => updateEmpStatus(val || null)} size="small" style={{ width: '100%' }} options={labelStatuses.map((s) => ({ value: s._id, label: <Tag color={s.color}>{s.label}</Tag> }))} />
                </Card>
              )}
              <Card size="small" title={sectionLabel('Consent')} style={cardStyle} styles={{ body: cardBodyStyle }}>
                <Select placeholder="Set consent status..." value={lead.consentStatus?._id || lead.consentStatus || undefined} loading={consentStatusSaving} onChange={(val) => updateConsentStatus(val || null)} size="small" style={{ width: '100%' }} options={consentStatuses.map((s) => ({ value: s._id, label: <Tag color={s.color}>{s.label}</Tag> }))} />
              </Card>
            </>
          )}

          {/* Read-only stage + consent (admin/agent) */}
          {role !== 'employee' && role !== 'agency' && (
            <>
              {lead.employeeStatus && (
                <Card size="small" title={sectionLabel('Stage Status')} style={cardStyle} styles={{ body: cardBodyStyle }}>
                  <Tag color={lead.employeeStatus.color} style={{ fontSize: 12 }}>{lead.employeeStatus.label}</Tag>
                </Card>
              )}
              {lead.consentStatus && (
                <Card size="small" title={sectionLabel('Consent')} style={cardStyle} styles={{ body: cardBodyStyle }}>
                  {(() => {
                    const COLOR_MAP = { blue: '#3b82f6', green: '#22c55e', gold: '#f59e0b', orange: '#f97316', red: '#ef4444', cyan: '#06b6d4', purple: '#a855f7', default: '#94a3b8' };
                    const c = COLOR_MAP[lead.consentStatus.color] || '#94a3b8';
                    return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, border: `1.5px solid ${c}`, fontSize: 11, fontWeight: 700, color: c, textTransform: 'uppercase' }}>
                        {lead.consentStatus.label}
                      </span>
                    );
                  })()}
                </Card>
              )}
            </>
          )}

          {/* Product Card — bottom of right column */}
          {product && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px', marginBottom: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 2 }}>
                {isLoan ? lead.loanProduct?.name : lead.cardProduct?.name}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: ['approved', 'disbursed'].includes(lead.status) ? 8 : 12 }}>
                {lead.bank?.name || ''}
                {!isLoan && lead.cardProduct?.cardType && (
                  <> · {({ regular: 'Regular', premium: 'Premium', rewards_lifestyle: 'Rewards & Lifestyle', travel: 'Travel', ecommerce: 'E-Commerce', legacy: 'Legacy' })[lead.cardProduct.cardType] || lead.cardProduct.cardType}</>
                )}
                {isLoan && lead.loanProduct?.loanCategory && (
                  <> · {lead.loanProduct.loanCategory === 'mortgage' ? 'Mortgage' : 'Personal Loan'}</>
                )}
              </div>
              {['approved', 'disbursed'].includes(lead.status) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
                  <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 12 }}>Authorized</span>
                </div>
              )}
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>Min Salary</div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                      {aed(isLoan ? lead.loanProduct?.minSalary : lead.cardProduct?.commissionBrackets?.[0]?.minimumSalary)}
                    </div>
                  </div>
                  <span style={{ color: '#cbd5e1', fontSize: 20, fontWeight: 300 }}>→</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>Payout</div>
                    <div style={{ fontWeight: 800, fontSize: 17, color: '#16a34a' }}>
                      {aed(role === 'agency' ? lead.grossCommission : lead.commission)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div>
                    {!isLoan && (() => {
                      const ft = lead.cardProduct?.commissionBrackets?.[0]?.feeType;
                      if (ft === 'free') return <span style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#16a34a', fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 5 }}>Free</span>;
                      if (ft === 'paid') return <span style={{ background: '#fef9c3', border: '1px solid #fde047', color: '#a16207', fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 5 }}>Paid</span>;
                      return null;
                    })()}
                    {isLoan && lead.loanProduct?.interestRateRange && (
                      <div style={{ fontSize: 11, color: '#64748b' }}>Rate: {lead.loanProduct.interestRateRange}</div>
                    )}
                  </div>
                  {!isLoan && lead.cardProduct?.cardImage && (
                    <img src={`${API_BASE}/uploads/card-images/${lead.cardProduct.cardImage}`} alt={lead.cardProduct.name} style={{ height: 46, objectFit: 'contain', borderRadius: 5, boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }} />
                  )}
                </div>
              </div>
              {isLoan && lead.loanAmount > 0 && (
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <InfoItem label="Loan Amount" value={aed(lead.loanAmount)} />
                  {lead.loanProduct?.maxLoanAmount > 0 && <InfoItem label="Max Loan" value={aed(lead.loanProduct.maxLoanAmount)} />}
                </div>
              )}
              {(product?.benefits || product?.feesEligibility) && (
                <button
                  onClick={() => setBenefitsOpen(true)}
                  style={{ marginTop: 12, width: '100%', background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 0', fontSize: 12, fontWeight: 600, color: '#4f46e5', cursor: 'pointer', letterSpacing: 0.2 }}
                >
                  Benefits &amp; Fees ↗
                </button>
              )}
            </div>
          )}

          {/* Commission — bottom right */}
          {role !== 'employee' && (
            <Card size="small" style={cardStyle} styles={{ body: cardBodyStyle }}>
              <div style={{ marginBottom: 10 }}>{sectionLabel('Commission')}</div>
              {role === 'agency' ? (
                <div>
                  <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Payable to Admin</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{aed(lead.grossCommission)}</div>
                  {lead.commissionStatus !== 'none' && (
                    <Tag color={COMM_COLORS[lead.commissionStatus]} style={{ marginTop: 4 }}>{COMM_LABELS[lead.commissionStatus]}</Tag>
                  )}
                </div>
              ) : (
                <>
                  {role === 'admin' && lead.grossCommission > 0 && (
                    <>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Gross (Receivable)</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{aed(lead.grossCommission)}</div>
                        {isLoan && lead.loanProduct && (
                          <div style={{ fontSize: 11, color: '#888' }}>{pct(lead.loanProduct.commissionBrackets?.[0]?.receivable)} of {aed(lead.loanAmount)}</div>
                        )}
                      </div>
                      <Divider style={{ margin: '6px 0' }} />
                    </>
                  )}
                  <div>
                    <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                      {role === 'agent' ? 'Expected Earning' : 'Agent Payout'}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{aed(lead.commission)}</div>
                    {lead.commissionStatus !== 'none' && (
                      <Tag color={COMM_COLORS[lead.commissionStatus]} style={{ marginTop: 4 }}>{COMM_LABELS[lead.commissionStatus]}</Tag>
                    )}
                    {lead.commissionPaidAt && (
                      <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>Paid {new Date(lead.commissionPaidAt).toLocaleDateString()}</div>
                    )}
                  </div>
                </>
              )}
            </Card>
          )}

        </Col>
      </Row>

      {/* Status update modal */}
      <Modal title={`Move to: ${statusModal.label}`} open={statusModal.open} onCancel={() => setStatusModal({ open: false, status: null, label: '' })} onOk={confirmStatusUpdate} okText="Confirm" confirmLoading={statusSaving} destroyOnClose>
        <Form form={statusNoteForm} layout="vertical">
          <Form.Item name="note" label="Note (optional)">
            <Input.TextArea rows={3} placeholder="Add a note for this stage update..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Loan amount modal */}
      <Modal title="Edit Loan Amount" open={loanOpen} onCancel={() => setLoanOpen(false)} onOk={saveLoanAmount} okText="Save" destroyOnClose>
        <Descriptions size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Client">{lead.customerName}</Descriptions.Item>
          <Descriptions.Item label="Product">{lead.loanProduct?.name}</Descriptions.Item>
        </Descriptions>
        <Form form={loanForm} layout="vertical">
          <Form.Item name="loanAmount" label="Loan Amount (AED)" rules={[{ required: true }]}>
            <InputNumber min={1} step={1000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* CPV / Activate modal */}
      <Modal title={actionModal.type === 'cpv' ? 'Mark CPV Done' : 'Mark Activated Done'} open={actionModal.open} onCancel={() => setActionModal({ open: false, type: null })} onOk={confirmAction} okText="Confirm" confirmLoading={actionSaving} destroyOnClose>
        <Form form={actionForm} layout="vertical">
          <Form.Item name="note" label="Note (optional)">
            <Input.TextArea rows={3} placeholder="Add a note..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
