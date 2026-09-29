import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Popconfirm, Tag, Tooltip, Alert, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, CheckCircleOutlined, LockOutlined } from '@ant-design/icons';
import api from '../../api/client';

const SCOPE_LABELS = {
  coordinator: 'Admin Coordinator',
  product: 'Product Admin',
  leads: 'Leads Control',
  finance: 'Finance (Account Panel)',
};
const SCOPE_OPTIONS = Object.entries(SCOPE_LABELS).map(([value, label]) => ({ value, label }));
const SCOPE_COLORS = { coordinator: 'purple', product: 'blue', leads: 'gold', finance: 'green' };

const AGENCY_TYPE_LABELS = { coordinator: 'Agency Coordinator', account: 'Account Access' };
const AGENCY_TYPE_OPTIONS = Object.entries(AGENCY_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const AGENCY_TYPE_COLORS = { coordinator: 'gold', account: 'green' };

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

function ManageAdmins() {
  // ── Scoped admin accounts (Coordinator/Product/Leads/Finance) ──────────
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [pwTarget, setPwTarget] = useState(null);
  const [pwSaving, setPwSaving] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [pwForm] = Form.useForm();

  // ── Agency Coordinator / Account Access accounts ────────────────────────
  const [agencyRows, setAgencyRows] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [agencyLoading, setAgencyLoading] = useState(false);
  const [agencyOpen, setAgencyOpen] = useState(false);
  const [agencySaving, setAgencySaving] = useState(false);
  const [agencyEditTarget, setAgencyEditTarget] = useState(null);
  const [agencyPwTarget, setAgencyPwTarget] = useState(null);
  const [agencyPwSaving, setAgencyPwSaving] = useState(false);
  const [agencyForm] = Form.useForm();
  const [agencyEditForm] = Form.useForm();
  const [agencyPwForm] = Form.useForm();

  const load = () => {
    setLoading(true);
    api.get('/admin/admins').then((res) => setAdmins(res.data)).finally(() => setLoading(false));
  };

  const loadAgencyRows = () => {
    setAgencyLoading(true);
    api.get('/admin/agency-employees').then((res) => setAgencyRows(res.data)).finally(() => setAgencyLoading(false));
  };

  useEffect(() => {
    load();
    loadAgencyRows();
    api.get('/agencies').then((res) => setAgencies(res.data)).catch(() => {});
  }, []);

  const agencyOptions = agencies.map((a) => ({ value: a._id, label: a.name || a.email }));

  const onSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await api.post('/admin/admins', values);
      message.success('Admin account created');
      setOpen(false);
      form.resetFields();
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to create admin account');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row) => {
    setEditTarget(row);
    editForm.setFieldsValue({ name: row.name, email: row.email, adminScope: row.adminScope });
  };

  const onEdit = async () => {
    const values = await editForm.validateFields();
    setSaving(true);
    try {
      await api.patch(`/admin/admins/${editTarget._id}`, values);
      message.success('Admin account updated');
      setEditTarget(null);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const onToggleActive = async (row) => {
    try {
      await api.patch(`/admin/admins/${row._id}/toggle-active`);
      message.success(row.isActive ? 'Account deactivated' : 'Account activated');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/admin/admins/${id}`);
      message.success('Admin account deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const openResetPassword = (row) => {
    setPwTarget(row);
    pwForm.resetFields();
  };

  const onResetPassword = async () => {
    const { password } = await pwForm.validateFields();
    setPwSaving(true);
    try {
      await api.patch(`/admin/admins/${pwTarget._id}/reset-password`, { password });
      message.success('Password updated');
      setPwTarget(null);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setPwSaving(false);
    }
  };

  // ── Agency Coordinator / Account Access handlers ────────────────────────
  const onAgencySubmit = async () => {
    const values = await agencyForm.validateFields();
    setAgencySaving(true);
    try {
      await api.post('/admin/agency-employees', values);
      message.success('Account created');
      setAgencyOpen(false);
      agencyForm.resetFields();
      loadAgencyRows();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to create account');
    } finally {
      setAgencySaving(false);
    }
  };

  const openAgencyEdit = (row) => {
    setAgencyEditTarget(row);
    agencyEditForm.setFieldsValue({ name: row.name, email: row.email, employeeType: row.employeeType });
  };

  const onAgencyEdit = async () => {
    const values = await agencyEditForm.validateFields();
    setAgencySaving(true);
    try {
      await api.patch(`/admin/agency-employees/${agencyEditTarget._id}`, values);
      message.success('Account updated');
      setAgencyEditTarget(null);
      loadAgencyRows();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setAgencySaving(false);
    }
  };

  const onAgencyToggleActive = async (row) => {
    try {
      await api.patch(`/admin/agency-employees/${row._id}/toggle-active`);
      message.success(row.isActive ? 'Account deactivated' : 'Account activated');
      loadAgencyRows();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    }
  };

  const onAgencyDelete = async (id) => {
    try {
      await api.delete(`/admin/agency-employees/${id}`);
      message.success('Account deleted');
      loadAgencyRows();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const openAgencyResetPassword = (row) => {
    setAgencyPwTarget(row);
    agencyPwForm.resetFields();
  };

  const onAgencyResetPassword = async () => {
    const { password } = await agencyPwForm.validateFields();
    setAgencyPwSaving(true);
    try {
      await api.patch(`/admin/agency-employees/${agencyPwTarget._id}/reset-password`, { password });
      message.success('Password updated');
      setAgencyPwTarget(null);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setAgencyPwSaving(false);
    }
  };

  const columns = [
    {
      title: 'Name',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.name}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{row.email}</div>
        </div>
      ),
    },
    {
      title: 'Scope',
      dataIndex: 'adminScope',
      render: (v) => <Tag color={SCOPE_COLORS[v]}>{SCOPE_LABELS[v] || v}</Tag>,
    },
    { title: 'Status', render: (_, row) => <StatusBadge active={row.isActive} /> },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      render: (d) => new Date(d).toLocaleDateString(),
    },
    {
      title: 'Actions',
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          </Tooltip>
          <Tooltip title="Reset Password">
            <Button size="small" icon={<LockOutlined />} onClick={() => openResetPassword(row)} />
          </Tooltip>
          <Tooltip title={row.isActive ? 'Deactivate' : 'Activate'}>
            <Button size="small" icon={row.isActive ? <StopOutlined /> : <CheckCircleOutlined />} onClick={() => onToggleActive(row)} />
          </Tooltip>
          <Popconfirm title="Delete this admin account?" description="This cannot be undone." onConfirm={() => onDelete(row._id)} okText="Delete" okButtonProps={{ danger: true }}>
            <Tooltip title="Delete">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const agencyColumns = [
    {
      title: 'Name',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.name}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{row.email}</div>
        </div>
      ),
    },
    { title: 'Agency', render: (_, row) => row.agency?.name || row.agency?.email || '—' },
    {
      title: 'Role',
      dataIndex: 'employeeType',
      render: (v) => <Tag color={AGENCY_TYPE_COLORS[v]}>{AGENCY_TYPE_LABELS[v] || v}</Tag>,
    },
    { title: 'Status', render: (_, row) => <StatusBadge active={row.isActive} /> },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      render: (d) => new Date(d).toLocaleDateString(),
    },
    {
      title: 'Actions',
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openAgencyEdit(row)} />
          </Tooltip>
          <Tooltip title="Reset Password">
            <Button size="small" icon={<LockOutlined />} onClick={() => openAgencyResetPassword(row)} />
          </Tooltip>
          <Tooltip title={row.isActive ? 'Deactivate' : 'Activate'}>
            <Button size="small" icon={row.isActive ? <StopOutlined /> : <CheckCircleOutlined />} onClick={() => onAgencyToggleActive(row)} />
          </Tooltip>
          <Popconfirm title="Delete this account?" description="This cannot be undone." onConfirm={() => onAgencyDelete(row._id)} okText="Delete" okButtonProps={{ danger: true }}>
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
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Roles & Permissions</h2>

      {/* ── Scoped admin accounts ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#334155' }}>Admin Accounts</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setOpen(true); }}>
          Add Scoped Admin
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Scoped admin accounts"
        description="These accounts see a restricted sidebar matching their scope (Coordinator/Product/Leads/Finance). The main Super Admin account isn't listed here and can't be edited or deleted from this screen."
      />

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 32 }}>
        <Table size="small" rowKey="_id" loading={loading} dataSource={admins} columns={columns} locale={{ emptyText: 'No scoped admin accounts yet' }} scroll={{ x: 'max-content' }} />
      </div>

      <Divider />

      {/* ── Agency Coordinator / Account Access ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 24 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#334155' }}>Agency Coordinator / Account Access</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { agencyForm.resetFields(); setAgencyOpen(true); }}>
          Add Account
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Agency-side scoped accounts"
        description="These log in to a specific agency with a restricted sidebar (Coordinator sees everything except payments; Account Access sees only payments/reports). The agency itself can also create these directly from its own Employees page."
      />

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <Table size="small" rowKey="_id" loading={agencyLoading} dataSource={agencyRows} columns={agencyColumns} locale={{ emptyText: 'No accounts yet' }} scroll={{ x: 'max-content' }} />
      </div>

      {/* Create scoped admin modal */}
      <Modal title="Add Scoped Admin" open={open} onCancel={() => setOpen(false)} onOk={onSubmit} okText="Create" confirmLoading={saving} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Password is required' }, { min: 6, message: 'Minimum 6 characters' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="adminScope" label="Scope" rules={[{ required: true, message: 'Select a scope' }]}>
            <Select options={SCOPE_OPTIONS} placeholder="Select scope" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit scoped admin modal */}
      <Modal title="Edit Admin" open={!!editTarget} onCancel={() => setEditTarget(null)} onOk={onEdit} okText="Save" confirmLoading={saving} destroyOnClose>
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="adminScope" label="Scope" rules={[{ required: true }]}>
            <Select options={SCOPE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reset password modal (scoped admin) */}
      <Modal title={`Reset Password — ${pwTarget?.name || pwTarget?.email || ''}`} open={!!pwTarget} onCancel={() => setPwTarget(null)} onOk={onResetPassword} okText="Update" confirmLoading={pwSaving} destroyOnClose>
        <Form form={pwForm} layout="vertical">
          <Form.Item name="password" label="New Password" rules={[{ required: true }, { min: 6, message: 'Minimum 6 characters' }]}>
            <Input.Password placeholder="New password" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create agency coordinator/account modal */}
      <Modal title="Add Agency Coordinator / Account Access" open={agencyOpen} onCancel={() => setAgencyOpen(false)} onOk={onAgencySubmit} okText="Create" confirmLoading={agencySaving} destroyOnClose>
        <Form form={agencyForm} layout="vertical">
          <Form.Item name="agency" label="Agency" rules={[{ required: true, message: 'Select an agency' }]}>
            <Select showSearch options={agencyOptions} placeholder="Select agency" filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())} />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Password is required' }, { min: 6, message: 'Minimum 6 characters' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="employeeType" label="Role" rules={[{ required: true, message: 'Select a role' }]}>
            <Select options={AGENCY_TYPE_OPTIONS} placeholder="Select role" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit agency coordinator/account modal */}
      <Modal title="Edit Account" open={!!agencyEditTarget} onCancel={() => setAgencyEditTarget(null)} onOk={onAgencyEdit} okText="Save" confirmLoading={agencySaving} destroyOnClose>
        <Form form={agencyEditForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="employeeType" label="Role" rules={[{ required: true }]}>
            <Select options={AGENCY_TYPE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reset password modal (agency coordinator/account) */}
      <Modal title={`Reset Password — ${agencyPwTarget?.name || agencyPwTarget?.email || ''}`} open={!!agencyPwTarget} onCancel={() => setAgencyPwTarget(null)} onOk={onAgencyResetPassword} okText="Update" confirmLoading={agencyPwSaving} destroyOnClose>
        <Form form={agencyPwForm} layout="vertical">
          <Form.Item name="password" label="New Password" rules={[{ required: true }, { min: 6, message: 'Minimum 6 characters' }]}>
            <Input.Password placeholder="New password" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default ManageAdmins;
