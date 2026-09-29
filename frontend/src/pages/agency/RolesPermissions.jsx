import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Popconfirm, Tooltip, Alert } from 'antd';
import { EditOutlined, DeleteOutlined, LockOutlined, UserAddOutlined, PoweroffOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../../api/client';

const ColHead = ({ children }) => (
  <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.8, textTransform: 'uppercase' }}>{children}</span>
);

// Only these two — CPV/Sales stay managed from the regular Employees page.
const ROLE_TYPE_OPTIONS = [
  { value: 'coordinator', label: 'Coordinator (all access except payment)' },
  { value: 'account', label: 'Account Access (payments & reports)' },
];

const TypePill = ({ type }) => {
  const map = {
    coordinator: { bg: '#fef3c7', border: '#fde68a', text: '#b45309', label: 'Coordinator' },
    account:     { bg: '#dcfce7', border: '#86efac', text: '#15803d', label: 'Account Access' },
  };
  const p = map[type] || { bg: '#f1f5f9', border: '#e2e8f0', text: '#475569', label: type || '—' };
  return (
    <span style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: 999, background: p.bg, border: `1.5px solid ${p.border}`, fontSize: 11, fontWeight: 700, color: p.text, whiteSpace: 'nowrap' }}>
      {p.label}
    </span>
  );
};

const StatusBadge = ({ active }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
    background: active ? '#f0fdf4' : '#f8fafc',
    border: `1px solid ${active ? '#bbf7d0' : '#e2e8f0'}`,
    fontSize: 11, fontWeight: 700,
    color: active ? '#15803d' : '#94a3b8',
  }}>
    <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? '#22c55e' : '#94a3b8' }} />
    {active ? 'Active' : 'Inactive'}
  </span>
);

function RolesPermissions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [addSaving, setAddSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm] = Form.useForm();
  const [editSaving, setEditSaving] = useState(false);

  const [pwOpen, setPwOpen] = useState(false);
  const [pwTarget, setPwTarget] = useState(null);
  const [pwForm] = Form.useForm();
  const [pwSaving, setPwSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/employees');
      setRows(data.filter((e) => e.employeeType === 'coordinator' || e.employeeType === 'account'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (id) => {
    try {
      await api.patch(`/employees/${id}/toggle`);
      message.success('Status updated');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update');
    }
  };

  const addRole = async () => {
    const values = await addForm.validateFields();
    setAddSaving(true);
    try {
      await api.post('/employees', values);
      message.success('Account added');
      setAddOpen(false);
      addForm.resetFields();
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to add account');
    } finally {
      setAddSaving(false);
    }
  };

  const openEdit = (row) => {
    setEditTarget(row);
    editForm.setFieldsValue({ name: row.name, email: row.email, employeeType: row.employeeType });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    const values = await editForm.validateFields();
    setEditSaving(true);
    try {
      await api.patch(`/employees/${editTarget._id}`, values);
      message.success('Account updated');
      setEditOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setEditSaving(false);
    }
  };

  const openPassword = (row) => {
    setPwTarget(row);
    pwForm.resetFields();
    setPwOpen(true);
  };

  const savePassword = async () => {
    const { password } = await pwForm.validateFields();
    setPwSaving(true);
    try {
      await api.patch(`/employees/${pwTarget._id}/password`, { password });
      message.success('Password updated');
      setPwOpen(false);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setPwSaving(false);
    }
  };

  const deleteRole = async (id) => {
    try {
      await api.delete(`/employees/${id}`);
      message.success('Account deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const columns = [
    {
      title: <ColHead>Name</ColHead>,
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{row.name || '—'}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{row.email}</div>
        </div>
      ),
    },
    {
      title: <ColHead>Role</ColHead>,
      dataIndex: 'employeeType',
      width: 150,
      render: (v) => <TypePill type={v} />,
    },
    { title: <ColHead>Status</ColHead>, dataIndex: 'isActive', width: 100, render: (v) => <StatusBadge active={v} /> },
    {
      title: <ColHead>Created</ColHead>,
      dataIndex: 'createdAt',
      width: 100,
      render: (v) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? new Date(v).toLocaleDateString() : '—'}</span>,
    },
    {
      title: <ColHead>Actions</ColHead>,
      width: 150,
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title={row.isActive ? 'Deactivate' : 'Activate'}>
            <Button size="small" icon={row.isActive ? <PoweroffOutlined /> : <CheckCircleOutlined />} onClick={() => toggleActive(row._id)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          </Tooltip>
          <Tooltip title="Change Password">
            <Button size="small" icon={<LockOutlined />} onClick={() => openPassword(row)} />
          </Tooltip>
          <Popconfirm title="Delete this account?" description="This cannot be undone." onConfirm={() => deleteRole(row._id)} okText="Delete" okButtonProps={{ danger: true }}>
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Roles & Permissions</h2>
        <Button type="primary" icon={<UserAddOutlined />} onClick={() => { addForm.resetFields(); setAddOpen(true); }}>
          Add Account
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Coordinator and Account Access"
        description="Coordinator sees everything your agency sees except payments. Account Access sees only payments and reports. Plain CPV/Sales staff are managed from the Employees page instead."
      />

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflowX: 'auto' }}>
        <Table size="small" rowKey="_id" loading={loading} dataSource={rows} columns={columns} tableLayout="fixed" scroll={{ x: 'max-content' }} locale={{ emptyText: 'No Coordinator/Account Access accounts yet' }} />
      </div>

      {/* Add modal */}
      <Modal title="Add Coordinator / Account Access" open={addOpen} onCancel={() => setAddOpen(false)} onOk={addRole} okText="Add" confirmLoading={addSaving} destroyOnClose>
        <Form form={addForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="Full name" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
            <Input placeholder="email@example.com" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Password is required' }]}>
            <Input.Password placeholder="Password" />
          </Form.Item>
          <Form.Item name="employeeType" label="Role" rules={[{ required: true, message: 'Select a role' }]}>
            <Select placeholder="Select role" options={ROLE_TYPE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit modal */}
      <Modal title="Edit Account" open={editOpen} onCancel={() => setEditOpen(false)} onOk={saveEdit} okText="Save" confirmLoading={editSaving} destroyOnClose>
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="Full name" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
            <Input placeholder="email@example.com" />
          </Form.Item>
          <Form.Item name="employeeType" label="Role" rules={[{ required: true }]}>
            <Select placeholder="Select role" options={ROLE_TYPE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Change password modal */}
      <Modal title={`Change Password — ${pwTarget?.name || pwTarget?.email || ''}`} open={pwOpen} onCancel={() => setPwOpen(false)} onOk={savePassword} okText="Update" confirmLoading={pwSaving} destroyOnClose>
        <Form form={pwForm} layout="vertical">
          <Form.Item name="password" label="New Password" rules={[{ required: true }, { min: 6, message: 'Minimum 6 characters' }]}>
            <Input.Password placeholder="New password" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default RolesPermissions;
