import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Row, Col, Popconfirm, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined, LockOutlined, UserAddOutlined, TableOutlined, AppstoreOutlined, PoweroffOutlined, CheckCircleOutlined } from '@ant-design/icons';
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
      width: 180,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Tooltip title={row.isActive ? 'Deactivate' : 'Activate'}>
            <button
              onClick={() => toggleActive(row._id)}
              style={{
                width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: row.isActive ? '#fef2f2' : '#f0fdf4',
                color: row.isActive ? '#ef4444' : '#22c55e',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
              }}
            >
              {row.isActive ? <PoweroffOutlined /> : <CheckCircleOutlined />}
            </button>
          </Tooltip>
          <Tooltip title="Edit">
            <button
              onClick={() => openEdit(row)}
              style={{
                width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#eef2ff', color: '#4f46e5',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
              }}
            >
              <EditOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Change Password">
            <button
              onClick={() => openPassword(row)}
              style={{
                width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#f0f9ff', color: '#0891b2',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
              }}
            >
              <LockOutlined />
            </button>
          </Tooltip>
          <Popconfirm title="Delete this employee?" description="This cannot be undone." onConfirm={() => deleteEmployee(row._id)} okText="Delete" okButtonProps={{ danger: true }}>
            <Tooltip title="Delete">
              <button
                style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: '#fef2f2', color: '#ef4444',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                }}
              >
                <DeleteOutlined />
              </button>
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Employees</h2>
        <Space>
          <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>Table</Button>
          <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} onClick={() => setViewMode('card')}>Cards</Button>
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => { addForm.resetFields(); setAddOpen(true); }}>
            Add Employee
          </Button>
        </Space>
      </div>

      {viewMode === 'table' ? (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <Table
            size="small"
            rowKey="_id"
            loading={loading}
            dataSource={employees}
            columns={columns}
            onRow={() => ({ style: { cursor: 'default' } })}
          />
        </div>
      ) : (
        <Row gutter={[14, 14]}>
          {employees.map((row) => (
            <Col key={row._id} xs={24} sm={12} lg={8}>
              <div
                className="lead-card"
                style={{
                  borderRadius: 16, border: '1px solid #e8eaf6', height: '100%',
                  background: '#ffffff', padding: '20px',
                  boxShadow: '0 4px 20px rgba(99,102,241,0.08), 0 1px 4px rgba(99,102,241,0.05)',
                  transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                }}
              >
                {/* Top row: avatar + info | badges */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {(row.name || row.email || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', lineHeight: 1.3 }}>{row.name || '—'}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{row.email}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <StatusBadge active={row.isActive} />
                    <TypePill type={row.employeeType} />
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                  <Tooltip title={row.isActive ? 'Deactivate' : 'Activate'}>
                    <button
                      onClick={() => toggleActive(row._id)}
                      style={{
                        width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: row.isActive ? '#fef2f2' : '#f0fdf4',
                        color: row.isActive ? '#ef4444' : '#22c55e',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                        transition: 'background 0.15s',
                      }}
                    >
                      {row.isActive ? <PoweroffOutlined /> : <CheckCircleOutlined />}
                    </button>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <button
                      onClick={() => openEdit(row)}
                      style={{
                        width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: '#eef2ff', color: '#4f46e5',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                        transition: 'background 0.15s',
                      }}
                    >
                      <EditOutlined />
                    </button>
                  </Tooltip>
                  <Tooltip title="Change Password">
                    <button
                      onClick={() => openPassword(row)}
                      style={{
                        width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: '#f0f9ff', color: '#0891b2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                        transition: 'background 0.15s',
                      }}
                    >
                      <LockOutlined />
                    </button>
                  </Tooltip>
                  <Popconfirm title="Delete this employee?" description="This cannot be undone." onConfirm={() => deleteEmployee(row._id)} okText="Delete" okButtonProps={{ danger: true }}>
                    <Tooltip title="Delete">
                      <button
                        style={{
                          width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                          background: '#fef2f2', color: '#ef4444',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                          transition: 'background 0.15s',
                        }}
                      >
                        <DeleteOutlined />
                      </button>
                    </Tooltip>
                  </Popconfirm>
                  <div style={{ fontSize: 11, color: '#b0b8c8', marginLeft: 'auto' }}>
                    Joined {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}
                  </div>
                </div>
              </div>
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
