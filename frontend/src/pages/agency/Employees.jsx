import { useEffect, useState } from 'react';
import { Table, Typography, Button, Modal, Form, Input, Select, message, Space, Row, Col, Popconfirm, Card } from 'antd';
import { EditOutlined, DeleteOutlined, LockOutlined, UserAddOutlined, TableOutlined, AppstoreOutlined } from '@ant-design/icons';
import api from '../../api/client';

const ColHead = ({ children }) => (
  <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.8, textTransform: 'uppercase' }}>{children}</span>
);

const TypePill = ({ type }) => {
  const map = {
    cpv:   { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', label: 'CPV' },
    sales: { bg: '#faf5ff', border: '#e9d5ff', text: '#7e22ce', label: 'Sales' },
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

function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table');

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
      setEmployees(data);
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

  const addEmployee = async () => {
    const values = await addForm.validateFields();
    setAddSaving(true);
    try {
      await api.post('/employees', values);
      message.success('Employee added');
      setAddOpen(false);
      addForm.resetFields();
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to add employee');
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
      message.success('Employee updated');
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

  const deleteEmployee = async (id) => {
    try {
      await api.delete(`/employees/${id}`);
      message.success('Employee deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const columns = [
    {
      title: <ColHead>Name</ColHead>,
      dataIndex: 'name',
      render: (v) => <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{v || '—'}</span>,
    },
    {
      title: <ColHead>Email</ColHead>,
      dataIndex: 'email',
      render: (v) => <span style={{ fontSize: 13, color: '#334155' }}>{v}</span>,
    },
    {
      title: <ColHead>Type</ColHead>,
      dataIndex: 'employeeType',
      width: 90,
      render: (v) => <TypePill type={v} />,
    },
    {
      title: <ColHead>Status</ColHead>,
      dataIndex: 'isActive',
      width: 100,
      render: (v) => <StatusBadge active={v} />,
    },
    {
      title: <ColHead>Created</ColHead>,
      dataIndex: 'createdAt',
      width: 100,
      render: (v) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? new Date(v).toLocaleDateString() : '—'}</span>,
    },
    {
      title: <ColHead>Actions</ColHead>,
      width: 280,
      render: (_, row) => (
        <Space size={6} style={{ flexWrap: 'nowrap' }}>
          <Button
            size="small"
            onClick={() => toggleActive(row._id)}
            style={row.isActive
              ? { borderColor: '#ef4444', color: '#ef4444', fontWeight: 600 }
              : { borderColor: '#22c55e', color: '#22c55e', fontWeight: 600 }}
          >
            {row.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          <Button size="small" icon={<LockOutlined />} onClick={() => openPassword(row)}>Password</Button>
          <Popconfirm
            title="Delete this employee?"
            description="This cannot be undone."
            onConfirm={() => deleteEmployee(row._id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Typography.Title level={4} style={{ margin: 0, fontWeight: 500 }}>Employees</Typography.Title>
          <Typography.Text type="secondary">Manage your agency's employees.</Typography.Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>Table</Button>
            <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} onClick={() => setViewMode('card')}>Cards</Button>
            <Button type="primary" icon={<UserAddOutlined />} onClick={() => { addForm.resetFields(); setAddOpen(true); }}>
              Add Employee
            </Button>
          </Space>
        </Col>
      </Row>

      {viewMode === 'table' ? (
        <Table
          size="small"
          rowKey="_id"
          loading={loading}
          dataSource={employees}
          columns={columns}
          onRow={() => ({ style: { cursor: 'default' } })}
        />
      ) : (
        <Row gutter={[14, 14]}>
          {employees.map((row) => (
            <Col key={row._id} xs={24} sm={12} lg={8}>
              <Card
                size="small"
                style={{ borderRadius: 12, border: '1px solid #e2e8f0', height: '100%' }}
                styles={{ body: { padding: '16px' } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{row.name || '—'}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{row.email}</div>
                  </div>
                  <StatusBadge active={row.isActive} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <TypePill type={row.employeeType} />
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
                  Joined {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}
                </div>
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Button size="small" onClick={() => toggleActive(row._id)}
                    style={row.isActive ? { borderColor: '#ef4444', color: '#ef4444' } : { borderColor: '#22c55e', color: '#22c55e' }}>
                    {row.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
                  <Button size="small" icon={<LockOutlined />} onClick={() => openPassword(row)}>Password</Button>
                  <Popconfirm title="Delete this employee?" description="This cannot be undone." onConfirm={() => deleteEmployee(row._id)} okText="Delete" okButtonProps={{ danger: true }}>
                    <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
                  </Popconfirm>
                </div>
              </Card>
            </Col>
          ))}
          {employees.length === 0 && (
            <Col span={24}><div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>No employees yet.</div></Col>
          )}
        </Row>
      )}

      {/* Add modal */}
      <Modal title="Add Employee" open={addOpen} onCancel={() => setAddOpen(false)} onOk={addEmployee} okText="Add" confirmLoading={addSaving} destroyOnClose>
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
          <Form.Item name="employeeType" label="Employee Type" rules={[{ required: true, message: 'Select a type' }]}>
            <Select placeholder="Select type" options={[{ value: 'cpv', label: 'CPV' }, { value: 'sales', label: 'Sales' }]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit modal */}
      <Modal title="Edit Employee" open={editOpen} onCancel={() => setEditOpen(false)} onOk={saveEdit} okText="Save" confirmLoading={editSaving} destroyOnClose>
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="Full name" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
            <Input placeholder="email@example.com" />
          </Form.Item>
          <Form.Item name="employeeType" label="Employee Type">
            <Select placeholder="Select type" allowClear options={[{ value: 'cpv', label: 'CPV' }, { value: 'sales', label: 'Sales' }]} />
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

export default Employees;
