import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Card, Col, Row, Typography, Tag, Space, Button, Descriptions, Skeleton,
  Timeline, Divider, message, Modal, Form, InputNumber, Input, Select, Image,
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
  const [assigningEmployee, setAssigningEmployee] = useState(null); // 'cpv' | 'sales'

  const [actionModal, setActionModal] = useState({ open: false, type: null }); // type: 'cpv' | 'activate'
  const [actionForm] = Form.useForm();
  const [actionSaving, setActionSaving] = useState(false);

  const [empStatuses, setEmpStatuses] = useState([]);
  const [empStatusSaving, setEmpStatusSaving] = useState(false);

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
    if (role === 'employee') {
      api.get('/employee-statuses').then((res) => setEmpStatuses(res.data.filter((s) => s.isActive))).catch(() => {});
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
      message.success(actionModal.type === 'cpv' ? 'CPV marked done' : 'Activate marked done');
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

  return (
    <>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(backPath)}>Back</Button>
            <Typography.Title level={4} style={{ margin: 0 }}>
              Lead{' '}
              <Typography.Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 16 }}>
                {lead.leadNumber || `LD-${String(lead._id).slice(-6)}`}
              </Typography.Text>
            </Typography.Title>
            <Tag color={statusMeta.color} style={{ fontSize: 13 }}>{statusMeta.label}</Tag>
            {role !== 'employee' && lead.commissionStatus !== 'none' && (
              <Tag color={COMM_COLORS[lead.commissionStatus]}>
                {COMM_LABELS[lead.commissionStatus]}
              </Tag>
            )}
          </Space>
        </Col>
        <Col>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Created {new Date(lead.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
            {' · '}Updated {new Date(lead.updatedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
          </Typography.Text>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* LEFT COLUMN */}
        <Col xs={24} lg={16}>

          {/* Customer */}
          <Card title="Customer" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Name">
                <strong>{lead.customerName}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Phone">{lead.phone}</Descriptions.Item>
              {lead.email && <Descriptions.Item label="Email">{lead.email}</Descriptions.Item>}
              {lead.customerSalary > 0 && (
                <Descriptions.Item label="Monthly Salary">{aed(lead.customerSalary)}</Descriptions.Item>
              )}
              {lead.nationality && <Descriptions.Item label="Nationality">{lead.nationality}</Descriptions.Item>}
              {lead.visaType && (
                <Descriptions.Item label="Visa Type">
                  {({ employment: 'Employment Visa', residence: 'Residence Visa', investor: 'Investor Visa', golden: 'Golden Visa', freelance: 'Freelance Visa', tourist: 'Tourist Visa', other: 'Other' })[lead.visaType] || lead.visaType}
                </Descriptions.Item>
              )}
              {lead.companyName && <Descriptions.Item label="Company">{lead.companyName}</Descriptions.Item>}
              {lead.jobTitle && <Descriptions.Item label="Job Title">{lead.jobTitle}</Descriptions.Item>}
              {lead.yearsOfExperience != null && lead.yearsOfExperience >= 0 && (
                <Descriptions.Item label="Experience">{lead.yearsOfExperience} yr{lead.yearsOfExperience !== 1 ? 's' : ''}</Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {/* Product */}
          <Card title="Product" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Type">
                <Tag color={isLoan ? 'purple' : 'blue'}>
                  {isLoan ? 'Loan' : 'Credit Card'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Bank">{lead.bank?.name || '—'}</Descriptions.Item>
              {!isLoan && lead.cardProduct && (
                <>
                  <Descriptions.Item label="Card">{lead.cardProduct.name}</Descriptions.Item>
                  <Descriptions.Item label="Card Type">
                    {(() => {
                      const labels = { regular: 'Regular', premium: 'Premium', rewards_lifestyle: 'Rewards & Lifestyle', travel: 'Travel', ecommerce: 'E-Commerce', legacy: 'Legacy' };
                      const colors = { regular: 'blue', premium: 'gold', rewards_lifestyle: 'green', travel: 'cyan', ecommerce: 'purple', legacy: 'volcano' };
                      const t = lead.cardProduct.cardType;
                      return <Tag color={colors[t] || 'default'}>{labels[t] || t}</Tag>;
                    })()}
                  </Descriptions.Item>
                  {lead.cardProduct.cardImage && (
                    <Descriptions.Item label="Card Image" span={2}>
                      <Image
                        src={`${API_BASE}/uploads/card-images/${lead.cardProduct.cardImage}`}
                        alt={lead.cardProduct.name}
                        style={{
                          width: 200,
                          height: 126,
                          objectFit: 'cover',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                        }}
                        preview={{ mask: 'View' }}
                      />
                    </Descriptions.Item>
                  )}
                </>
              )}
              {isLoan && lead.loanProduct && (
                <>
                  <Descriptions.Item label="Loan Product">{lead.loanProduct.name}</Descriptions.Item>
                  <Descriptions.Item label="Category">
                    <Tag color={lead.loanProduct.loanCategory === 'mortgage' ? 'purple' : 'cyan'}>
                      {lead.loanProduct.loanCategory === 'mortgage' ? 'Mortgage' : 'Personal Loan'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Loan Amount">
                    <strong>{aed(lead.loanAmount)}</strong>
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
          </Card>

          {/* People */}
          {role === 'admin' && (
            <Card title="People" style={{ marginBottom: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Agent">
                  <span style={{ fontWeight: 600 }}>{lead.agent?.name || '—'}</span>
                  {lead.agent?.email && (
                    <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{lead.agent.email}</span>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Agency">
                  <span style={{ fontWeight: 600 }}>{lead.agency?.name || '—'}</span>
                  {lead.agency?.email && (
                    <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{lead.agency.email}</span>
                  )}
                </Descriptions.Item>
                {lead.assignedCpvEmployee && (
                  <Descriptions.Item label="CPV Employee">
                    <span style={{ fontWeight: 600 }}>{lead.assignedCpvEmployee.name || '—'}</span>
                    {lead.assignedCpvEmployee.email && (
                      <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{lead.assignedCpvEmployee.email}</span>
                    )}
                  </Descriptions.Item>
                )}
                {lead.assignedSalesEmployee && (
                  <Descriptions.Item label="Sales Employee">
                    <span style={{ fontWeight: 600 }}>{lead.assignedSalesEmployee.name || '—'}</span>
                    {lead.assignedSalesEmployee.email && (
                      <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>{lead.assignedSalesEmployee.email}</span>
                    )}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          )}

          {/* Disbursement receipt */}
          {role !== 'agent' && (lead.status === 'disbursed' || lead.disbursementReceipt || lead.disbursementReceiptFile) && (
            <Card title="Disbursement Receipt" style={{ marginBottom: 16 }}>
              {lead.disbursementReceipt || lead.disbursementReceiptFile ? (
                <Descriptions column={1}>
                  {lead.disbursementReceipt && (
                    <Descriptions.Item label="Reference No.">
                      <strong style={{ fontFamily: 'monospace' }}>{lead.disbursementReceipt}</strong>
                    </Descriptions.Item>
                  )}
                  {lead.disbursementReceiptFile && (
                    <Descriptions.Item label="File">
                      <a
                        href={`${API_BASE}/uploads/receipts/${lead.disbursementReceiptFile}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileOutlined /> View / Download
                      </a>
                    </Descriptions.Item>
                  )}
                  {lead.disbursementReceiptAt && (
                    <Descriptions.Item label="Submitted">
                      {new Date(lead.disbursementReceiptAt).toLocaleString()}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              ) : (
                <Typography.Text type="secondary">No receipt submitted yet.</Typography.Text>
              )}
            </Card>
          )}

          {/* Status history */}
          {lead.statusHistory?.length > 0 && (
            <Card title="Status History" style={{ marginBottom: 16 }}>
              <Timeline
                items={[...lead.statusHistory].reverse().map((h) => {
                  const meta = statusMap[h.status] || { color: 'default', label: h.status };
                  return {
                    color: meta.color === 'default' ? 'gray' : meta.color,
                    children: (
                      <div>
                        <Tag color={meta.color} style={{ marginBottom: 2 }}>{meta.label}</Tag>
                        {h.note && (
                          <div style={{ fontSize: 13, color: '#444', marginTop: 4 }}>{h.note}</div>
                        )}
                        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                          {new Date(h.changedAt).toLocaleString()}
                          {role !== 'agent' && h.changedBy && ` · ${h.changedBy.name || h.changedBy.email}`}
                        </div>
                      </div>
                    ),
                  };
                })}
              />
            </Card>
          )}

          {/* Notes */}
          <Card title="Notes" style={{ marginBottom: 16 }}>
            {(lead.leadNotes ?? []).length > 0 ? (
              <div style={{ marginBottom: 16 }}>
                {lead.leadNotes.map((n) => (
                  <div
                    key={n._id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      background: '#f9f9f6',
                      marginBottom: 8,
                      position: 'relative',
                    }}
                  >
                    <Space size={6} style={{ marginBottom: 4 }}>
                      {(() => {
                        const hiddenFromViewer =
                          (n.authorRole === 'admin' && role !== 'admin') ||
                          (n.authorRole === 'agency' && role === 'agent');
                        const employeeAnonymised = n.authorRole === 'employee' && role === 'agent';
                        return hiddenFromViewer ? (
                          <Typography.Text strong style={{ fontSize: 13 }}>Staff</Typography.Text>
                        ) : employeeAnonymised ? (
                          <>
                            <Typography.Text strong style={{ fontSize: 13, fontFamily: 'monospace' }}>
                              {n.author?.employeeId || 'Staff'}
                            </Typography.Text>
                            <Tag style={{ fontSize: 11, lineHeight: '18px', padding: '0 6px' }}>employee</Tag>
                          </>
                        ) : (
                          <>
                            <Typography.Text strong style={{ fontSize: 13 }}>
                              {n.author?.name || n.author?.email || 'Unknown'}
                            </Typography.Text>
                            <Tag style={{ fontSize: 11, lineHeight: '18px', padding: '0 6px' }}>
                              {n.authorRole}
                            </Tag>
                          </>
                        );
                      })()}
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {new Date(n.createdAt).toLocaleString()}
                      </Typography.Text>
                    </Space>
                    <div style={{ fontSize: 13, color: '#333', whiteSpace: 'pre-wrap' }}>{n.text}</div>
                    {role === 'admin' && (
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        loading={deletingNoteId === n._id}
                        disabled={deletingNoteId === n._id}
                        style={{ position: 'absolute', top: 8, right: 8 }}
                        onClick={() => deleteNote(n._id)}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                No notes yet.
              </Typography.Text>
            )}
            <Input.TextArea
              rows={3}
              placeholder="Add a note..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <Button
              type="primary"
              loading={noteSubmitting}
              disabled={!noteText.trim()}
              onClick={addNote}
            >
              Add Note
            </Button>
          </Card>

          {/* Payout history */}
          {lead.payoutHistory?.length > 0 && (
            <Card title="Payout History" style={{ marginBottom: 16 }}>
              <Timeline
                items={[...lead.payoutHistory].reverse().map((p) => ({
                  color: 'green',
                  children: (
                    <div>
                      <strong>{aed(p.amount)}</strong>
                      <div style={{ fontSize: 12, color: '#888' }}>
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

          {/* Commission */}
          {role !== 'employee' && <Card title="Commission" style={{ marginBottom: 16 }}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {role === 'agency' ? (
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Payable to Admin
                  </Typography.Text>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{aed(lead.grossCommission)}</div>
                  {lead.commissionStatus !== 'none' && (
                    <Tag color={COMM_COLORS[lead.commissionStatus]} style={{ marginTop: 4 }}>
                      {COMM_LABELS[lead.commissionStatus]}
                    </Tag>
                  )}
                </div>
              ) : (
                <>
                  {role === 'admin' && lead.grossCommission > 0 && (
                    <>
                      <div>
                        <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Gross (Receivable)
                        </Typography.Text>
                        <div style={{ fontSize: 20, fontWeight: 700 }}>{aed(lead.grossCommission)}</div>
                        {isLoan && lead.loanProduct && (
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {pct(lead.loanProduct.commissionBrackets?.[0]?.receivable)} of {aed(lead.loanAmount)}
                          </Typography.Text>
                        )}
                      </div>
                      <Divider style={{ margin: '4px 0' }} />
                    </>
                  )}
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {role === 'agent' ? 'Expected Payout' : 'Agent Payout'}
                    </Typography.Text>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{aed(lead.commission)}</div>
                    {lead.commissionStatus !== 'none' && (
                      <Tag color={COMM_COLORS[lead.commissionStatus]} style={{ marginTop: 4 }}>
                        {COMM_LABELS[lead.commissionStatus]}
                      </Tag>
                    )}
                    {lead.commissionPaidAt && (
                      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                        Paid {new Date(lead.commissionPaidAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </>
              )}
            </Space>
          </Card>}

          {/* Agency Actions */}
          {role === 'agency' && (
            <Card title="Actions" style={{ marginBottom: 16 }}>
              {(lead.assignedCpvEmployee || lead.assignedSalesEmployee) && (
                <div style={{ marginBottom: 12, padding: '8px 10px', background: '#f0f7ff', borderRadius: 6 }}>
                  {lead.assignedCpvEmployee && (
                    <div style={{ marginBottom: lead.assignedSalesEmployee ? 6 : 0 }}>
                      <Typography.Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>CPV</Typography.Text>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{lead.assignedCpvEmployee.name || lead.assignedCpvEmployee.email}</div>
                    </div>
                  )}
                  {lead.assignedSalesEmployee && (
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sales</Typography.Text>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{lead.assignedSalesEmployee.name || lead.assignedSalesEmployee.email}</div>
                    </div>
                  )}
                </div>
              )}
              {/* CPV / Activate status indicators */}
              {(lead.cpvDone || lead.activateDone) && (
                <Space style={{ marginBottom: 12, flexWrap: 'wrap' }}>
                  {lead.cpvDone && <Tag color="green">CPV ✓</Tag>}
                  {lead.activateDone && <Tag color="green">Activate ✓</Tag>}
                </Space>
              )}
              <Space direction="vertical" style={{ width: '100%' }}>
                {['submitted', 'under_review', 'assigned'].includes(lead.status) && (
                  <Button block type="primary" icon={<CheckOutlined />} onClick={() => openStatusModal('approved', 'Approved')}>
                    Approve
                  </Button>
                )}
                {lead.status === 'approved' && !lead.cpvDone && (
                  <Button block onClick={() => { actionForm.resetFields(); setActionModal({ open: true, type: 'cpv' }); }}>CPV</Button>
                )}
                {lead.status === 'approved' && !lead.activateDone && (
                  <Button block onClick={() => { actionForm.resetFields(); setActionModal({ open: true, type: 'activate' }); }}>Activate</Button>
                )}
                {lead.status === 'approved' && lead.cpvDone && lead.activateDone && (
                  <Button block onClick={() => openStatusModal('disbursed', 'Disbursed')}>Mark Disbursed</Button>
                )}
                {isLoan && LOAN_EDITABLE_FROM.includes(lead.status) && (
                  <Button block icon={<EditOutlined />} onClick={() => {
                    loanForm.setFieldsValue({ loanAmount: lead.loanAmount });
                    setLoanOpen(true);
                  }}>
                    Edit Loan Amount
                  </Button>
                )}
                {REJECTABLE_FROM.includes(lead.status) && (
                  <Button block danger icon={<CloseOutlined />} onClick={() => openStatusModal('rejected', 'Rejected')}>
                    Reject
                  </Button>
                )}
                {!['disbursed', 'rejected'].includes(lead.status) && (
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>
                      Assign Employees
                    </Typography.Text>
                    <Select
                      allowClear
                      placeholder="CPV employee"
                      loading={assigningEmployee === 'cpv'}
                      value={lead.assignedCpvEmployee?._id || undefined}
                      onChange={(val) => assignEmployee(val || null, 'cpv')}
                      style={{ width: '100%', marginBottom: 6 }}
                      options={employees.filter((e) => e.isActive && e.employeeType === 'cpv').map((e) => ({ value: e._id, label: e.name || e.email }))}
                    />
                    <Select
                      allowClear
                      placeholder="Sales employee"
                      loading={assigningEmployee === 'sales'}
                      value={lead.assignedSalesEmployee?._id || undefined}
                      onChange={(val) => assignEmployee(val || null, 'sales')}
                      style={{ width: '100%' }}
                      options={employees.filter((e) => e.isActive && e.employeeType === 'sales').map((e) => ({ value: e._id, label: e.name || e.email }))}
                    />
                  </div>
                )}
              </Space>
            </Card>
          )}

          {/* Employee Actions */}
          {role === 'employee' && (
            <Card title="Actions" style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {lead.status === 'assigned' && (
                  <Button block type="primary" icon={<CheckOutlined />} onClick={() => openStatusModal('approved', 'Approved')}>
                    Approve
                  </Button>
                )}
                {lead.status === 'approved' && lead.cpvDone && lead.activateDone && (
                  <Button
                    block
                    icon={<DollarOutlined />}
                    style={{ background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' }}
                    onClick={() => openStatusModal('disbursed', 'Disbursed')}
                  >
                    Mark Disbursed
                  </Button>
                )}
                {lead.status === 'approved' && !(lead.cpvDone && lead.activateDone) && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Waiting for{!lead.cpvDone ? ' CPV' : ''}{!lead.cpvDone && !lead.activateDone ? ' &' : ''}{!lead.activateDone ? ' Activation' : ''} to enable Disburse
                  </Typography.Text>
                )}
                {['assigned', 'approved'].includes(lead.status) && (
                  <Button block danger icon={<CloseOutlined />} onClick={() => openStatusModal('rejected', 'Rejected')}>
                    Reject
                  </Button>
                )}
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>
                    Status Label
                  </Typography.Text>
                  <Select
                    allowClear
                    placeholder="Set status..."
                    value={lead.employeeStatus?._id || lead.employeeStatus || undefined}
                    loading={empStatusSaving}
                    onChange={(val) => updateEmpStatus(val || null)}
                    style={{ width: '100%' }}
                    options={empStatuses.map((s) => ({ value: s._id, label: <Tag color={s.color}>{s.label}</Tag> }))}
                  />
                </div>
              </Space>
            </Card>
          )}

          {/* Employee status for all roles (read-only) */}
          {lead.employeeStatus && role !== 'employee' && (
            <Card title="Lead Status" style={{ marginBottom: 16 }}>
              <Tag color={lead.employeeStatus.color} style={{ fontSize: 13 }}>
                {lead.employeeStatus.label}
              </Tag>
            </Card>
          )}

        </Col>
      </Row>

      {/* Status update modal with note */}
      <Modal
        title={`Move to: ${statusModal.label}`}
        open={statusModal.open}
        onCancel={() => setStatusModal({ open: false, status: null, label: '' })}
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
      <Modal
        title={actionModal.type === 'cpv' ? 'Mark CPV Done' : 'Mark Activate Done'}
        open={actionModal.open}
        onCancel={() => setActionModal({ open: false, type: null })}
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


</>
  );
}
