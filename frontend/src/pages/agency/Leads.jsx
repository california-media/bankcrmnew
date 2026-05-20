import { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Typography, Button, Input, Select, DatePicker, Row, Col, Space, message, Modal, Form, InputNumber, Descriptions, Tabs, Card, Empty } from 'antd';
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

const WaIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
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
    const { employeeId } = await bulkAssignForm.validateFields();
    try {
      const { data } = await api.post('/leads/bulk-assign-employee', { leadIds: selectedRowKeys, employeeId });
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
        <div style={{ maxWidth: 180 }}>
          <Typography.Text ellipsis={{ tooltip: name }} style={{ fontWeight: 600, fontSize: 12, display: 'block' }}>{name}</Typography.Text>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{row.cardProduct.cardType === 'premium' ? 'Premium' : 'Regular'}</span>
        </div>
      );
    }
    if (row.productType === 'loan' && row.loanProduct) {
      const name = row.loanProduct.name;
      return (
        <div style={{ maxWidth: 180 }}>
          <Typography.Text ellipsis={{ tooltip: name }} style={{ fontWeight: 600, fontSize: 12, display: 'block' }}>{name}</Typography.Text>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{row.loanProduct.loanCategory === 'mortgage' ? 'Mortgage' : 'Personal'} · {aed(row.loanAmount)}</span>
        </div>
      );
    }
    return PRODUCTS.find((p) => p.value === row.productType)?.label || row.productType;
  };

  const columns = [
    { title: 'Lead ID', dataIndex: 'leadNumber', width: 130,
      render: (leadNumber) => (
        <Typography.Text type="secondary" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{leadNumber || '—'}</Typography.Text>
      ),
    },
    {
      title: 'Client',
      dataIndex: 'customerName',
      render: (v, row) => (
        <div style={{ lineHeight: 1.3 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{row.phone}</span>
            {row.phone && (
              <a
                href={buildWhatsAppUrl(row)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#25d366', color: '#fff',
                  flexShrink: 0, lineHeight: 1,
                }}
                title="Send WhatsApp consent message"
              >
                <WaIcon />
              </a>
            )}
          </div>
        </div>
      ),
    },
    { title: 'Product', render: (_, row) => renderProduct(row) },
    { title: 'Bank', dataIndex: ['bank', 'name'] },
    {
      title: 'Stage',
      dataIndex: 'status',
      render: (s) => {
        const meta = STATUSES.find((x) => x.value === s);
        return <Tag color={meta?.color}>{meta?.label || s}</Tag>;
      },
    },
    {
      title: 'Emp. Status',
      render: (_, row) => row.employeeStatus
        ? <Tag color={row.employeeStatus.color}>{row.employeeStatus.label}</Tag>
        : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'CPV',
      width: 150,
      render: (_, row) => {
        const canAssign = !TERMINAL_STATUSES.includes(row.status);
        const cpvEmployees = employees.filter((e) => e.isActive && e.employeeType === 'cpv');
        if (!canAssign) {
          return row.assignedCpvEmployee
            ? <Typography.Text style={{ fontSize: 12 }}>{row.assignedCpvEmployee.name || row.assignedCpvEmployee.email}</Typography.Text>
            : <Typography.Text type="secondary">—</Typography.Text>;
        }
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Select size="small" allowClear placeholder="CPV employee"
              loading={assigningLead === `${row._id}-cpv`}
              value={row.assignedCpvEmployee?._id || undefined}
              onChange={(val) => assignSingle(row._id, val || null, 'cpv')}
              style={{ width: '100%', minWidth: 130 }}
              options={cpvEmployees.map((e) => ({ value: e._id, label: e.name || e.email }))}
            />
          </div>
        );
      },
    },
    {
      title: 'Sales',
      width: 150,
      render: (_, row) => {
        const canAssign = !TERMINAL_STATUSES.includes(row.status);
        const salesEmployees = employees.filter((e) => e.isActive && e.employeeType === 'sales');
        if (!canAssign) {
          return row.assignedSalesEmployee
            ? <Typography.Text style={{ fontSize: 12 }}>{row.assignedSalesEmployee.name || row.assignedSalesEmployee.email}</Typography.Text>
            : <Typography.Text type="secondary">—</Typography.Text>;
        }
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Select size="small" allowClear placeholder="Sales employee"
              loading={assigningLead === `${row._id}-sales`}
              value={row.assignedSalesEmployee?._id || undefined}
              onChange={(val) => assignSingle(row._id, val || null, 'sales')}
              style={{ width: '100%', minWidth: 130 }}
              options={salesEmployees.map((e) => ({ value: e._id, label: e.name || e.email }))}
            />
          </div>
        );
      },
    },
    {
      title: 'Actions',
      width: 'auto',
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
          <Space size={4} onClick={(e) => e.stopPropagation()} style={{ flexWrap: 'nowrap' }}>
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
      },
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Typography.Title level={3} style={{ margin: 0 }}>Lead Queue</Typography.Title>
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
          scroll={{ x: 900 }}
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
                            style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 18, height: 18, borderRadius: '50%',
                              background: '#25d366', color: '#fff', flexShrink: 0,
                            }}
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
        title="Assign to Employee"
        open={bulkAssignOpen}
        onCancel={() => setBulkAssignOpen(false)}
        onOk={bulkAssign}
        okText="Assign"
        destroyOnClose
      >
        <Form form={bulkAssignForm} layout="vertical">
          <Form.Item name="employeeId" label="Employee" rules={[{ required: true, message: 'Select an employee' }]}>
            <Select
              placeholder="Select employee"
              options={employees.filter((e) => e.isActive).map((e) => ({ value: e._id, label: e.name || e.email }))}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default AgencyLeads;
