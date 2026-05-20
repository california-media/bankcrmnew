import { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Typography, Input, Tabs, Select, message, Button, Modal, Space } from 'antd';
import { SearchOutlined, CheckOutlined, CloseOutlined, DollarOutlined } from '@ant-design/icons';
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

const PRODUCT_LABELS = { credit_card: 'Credit Card', loan: 'Loan' };

function AssignedLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [leadsTab, setLeadsTab] = useState('active');
  const [empStatuses, setEmpStatuses] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [statusModal, setStatusModal] = useState({ open: false, leadId: null, status: null, label: '', note: '' });
  const [statusSaving, setStatusSaving] = useState(false);

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
    api.get('/employee-statuses').then((res) => setEmpStatuses(res.data.filter((s) => s.isActive)));
  }, []);

  const openStatusModal = (leadId, status, label) =>
    setStatusModal({ open: true, leadId, status, label, note: '' });

  const confirmStatusChange = async () => {
    setStatusSaving(true);
    try {
      const { data } = await api.patch(`/leads/${statusModal.leadId}/status`, {
        status: statusModal.status,
        note: statusModal.note || undefined,
      });
      setLeads((prev) => prev.map((l) => (l._id === statusModal.leadId ? data : l)));
      message.success(`Lead marked as ${statusModal.label}`);
      setStatusModal({ open: false, leadId: null, status: null, label: '', note: '' });
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setStatusSaving(false);
    }
  };

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
      title: 'Lead ID',
      dataIndex: 'leadNumber',
      render: (v) => (
        <Typography.Text type="secondary" style={{ fontFamily: 'monospace', width: 130, whiteSpace: 'nowrap' }}>
          {v || '—'}
        </Typography.Text>
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
    {
      title: 'Product',
      dataIndex: 'productType',
      render: (v) => (
        <Tag>{PRODUCT_LABELS[v] || v}</Tag>
      ),
    },
    {
      title: 'Bank',
      dataIndex: ['bank', 'name'],
    },
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
      render: (_, row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Select
            size="small"
            allowClear
            placeholder="Set status"
            loading={updatingStatus === row._id}
            value={row.employeeStatus?._id || undefined}
            onChange={(val) => updateEmpStatus(row._id, val)}
            style={{ minWidth: 140 }}
            options={empStatuses.map((s) => ({
              value: s._id,
              label: <Tag color={s.color} style={{ margin: 0 }}>{s.label}</Tag>,
            }))}
          />
        </div>
      ),
    },
    {
      title: 'Engagement',
      dataIndex: 'engagementStatus',
      render: (v) =>
        v ? <Tag>{v}</Tag> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Submitted',
      dataIndex: 'createdAt',
      render: (v) => v ? new Date(v).toLocaleDateString() : '—',
    },
    {
      title: 'Actions',
      render: (_, row) => {
        const canApprove = row.status === 'assigned';
        const canDisburse = row.status === 'approved' && row.cpvDone && row.activateDone;
        const canReject = ['assigned', 'approved'].includes(row.status);
        if (!canApprove && !canDisburse && !canReject) return null;
        return (
          <Space size={4} onClick={(e) => e.stopPropagation()}>
            {canApprove && (
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => openStatusModal(row._id, 'approved', 'Approved')}
              >
                Approve
              </Button>
            )}
            {canDisburse && (
              <Button
                size="small"
                icon={<DollarOutlined />}
                style={{ background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' }}
                onClick={() => openStatusModal(row._id, 'disbursed', 'Disbursed')}
              >
                Disburse
              </Button>
            )}
            {canReject && (
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => openStatusModal(row._id, 'rejected', 'Rejected')}
              >
                Reject
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <Typography.Title level={3} style={{ margin: '0 0 8px' }}>My Leads</Typography.Title>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Leads assigned to you.
      </Typography.Text>

      <Input
        allowClear
        placeholder="Search client or lead ID..."
        prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: 280, marginBottom: 16 }}
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

      <Table
        size="small"
        rowKey="_id"
        loading={loading}
        dataSource={filtered}
        columns={columns}
        scroll={{ x: 'max-content' }}
        onRow={(row) => ({
          onClick: () => navigate(`/employee/leads/${row._id}`),
          style: { cursor: 'pointer' },
        })}
      />

      <Modal
        title={`Move to: ${statusModal.label}`}
        open={statusModal.open}
        onCancel={() => setStatusModal({ open: false, leadId: null, status: null, label: '', note: '' })}
        onOk={confirmStatusChange}
        okText="Confirm"
        okButtonProps={{ danger: statusModal.status === 'rejected', loading: statusSaving }}
      >
        <Input.TextArea
          rows={3}
          placeholder="Add a note (optional)..."
          value={statusModal.note}
          onChange={(e) => setStatusModal((prev) => ({ ...prev, note: e.target.value }))}
          style={{ marginTop: 8 }}
        />
      </Modal>
    </>
  );
}

export default AssignedLeads;
