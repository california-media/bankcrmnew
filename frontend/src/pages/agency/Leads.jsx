import { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Typography, Button, Input, Select, DatePicker, Row, Col, Space, message, Modal, Form, InputNumber, Descriptions, Tabs } from 'antd';
import { SearchOutlined, CheckOutlined, CloseOutlined, EditOutlined, UserAddOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

const STATUSES = [
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

const TERMINAL_STATUSES  = ['disbursed', 'rejected'];
const REJECTABLE_FROM    = ['submitted', 'under_review', 'assigned', 'approved'];
const LOAN_EDITABLE_FROM = ['submitted', 'under_review', 'assigned', 'approved'];

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

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

  // Bulk assign
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignForm] = Form.useForm();
  const [employees, setEmployees] = useState([]);

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

  const activeCount = leads.filter(l => l.status !== 'disbursed').length;
  const archiveCount = leads.filter(l => l.status === 'disbursed').length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const [from, to] = dateRange || [];
    return leads.filter((l) => {
      if (leadsTab === 'archive' && l.status !== 'disbursed') return false;
      if (leadsTab === 'active' && l.status === 'disbursed') return false;
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
      return (
        <div>
          <div style={{ fontWeight: 600 }}>{row.cardProduct.name}</div>
          <div style={{ fontSize: 12, color: '#888' }}>
            {row.cardProduct.cardType === 'premium' ? 'Premium' : 'Regular'}
          </div>
        </div>
      );
    }
    if (row.productType === 'loan' && row.loanProduct) {
      return (
        <div>
          <div style={{ fontWeight: 600 }}>{row.loanProduct.name}</div>
          <div style={{ fontSize: 12, color: '#888' }}>
            {row.loanProduct.loanCategory === 'mortgage' ? 'Mortgage' : 'Personal'} · {aed(row.loanAmount)}
          </div>
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
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{row.phone}</div>
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
      title: 'Assigned To',
      render: (_, row) => row.assignedEmployee
        ? (row.assignedEmployee.name || row.assignedEmployee.email)
        : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Actions',
      width: 'auto',
      render: (_, row) => {
        const canReject  = REJECTABLE_FROM.includes(row.status);
        const canEditLoan = row.productType === 'loan' && LOAN_EDITABLE_FROM.includes(row.status);
        const hasWorkflow = row.status === 'submitted' || row.status === 'under_review' ||
          row.status === 'assigned' || row.status === 'approved' || canEditLoan || canReject;
        const canAssign = !TERMINAL_STATUSES.includes(row.status);
        if (!hasWorkflow && !canAssign) return null;
        return (
          <Space wrap onClick={(e) => e.stopPropagation()}>
            {row.status === 'submitted' && (
              <Button size="small" onClick={() => openStatusModal(row._id, 'under_review', 'Under Review')}>Start Review</Button>
            )}
            {row.status === 'under_review' && (
              <Button size="small" onClick={() => openStatusModal(row._id, 'assigned', 'Assigned')}>Mark Assigned</Button>
            )}
            {row.status === 'assigned' && (
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => openStatusModal(row._id, 'approved', 'Approved')}>
                Approve
              </Button>
            )}
            {row.status === 'approved' && (
              <Button size="small" onClick={() => openStatusModal(row._id, 'disbursed', 'Disbursed')}>Mark Disbursed</Button>
            )}
            {canEditLoan && (
              <Button size="small" icon={<EditOutlined />} onClick={() => openLoanEdit(row)}>
                Edit Loan Amount
              </Button>
            )}
            {canReject && (
              <Button size="small" danger icon={<CloseOutlined />} onClick={() => openStatusModal(row._id, 'rejected', 'Rejected')}>
                Reject
              </Button>
            )}
            {canAssign && (
              <Button
                size="small"
                icon={<UserAddOutlined />}
                onClick={() => { bulkAssignForm.resetFields(); setSelectedRowKeys([row._id]); setBulkAssignOpen(true); }}
              >
                Assign
              </Button>
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
      </Row>

      <Space wrap style={{ margin: '24px 0 16px', width: '100%', justifyContent: 'space-between' }}>
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
          { key: 'archive', label: `Archive (${archiveCount})` },
        ]}
      />

      <Table
        size="small"
        rowKey="_id"
        loading={loading}
        dataSource={filtered}
        columns={columns}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        onRow={(row) => ({ onClick: () => navigate(`/agency/leads/${row._id}`), style: { cursor: 'pointer' } })}
        scroll={{ x: 'max-content' }}
      />

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
