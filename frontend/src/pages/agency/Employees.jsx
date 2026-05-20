import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Button, Modal, Form, Input, Select, message, Space, Row, Col, Popconfirm } from 'antd';
import { EditOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons';
import api from '../../api/client';

function Employees() {
  const [employees, setEmployees] = useState([]);
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
      title: 'Name',
      dataIndex: 'name',
      render: (v) => v || <Typography.Text type="secondary">—</Typography.Text>,
    },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Type',
      dataIndex: 'employeeType',
      render: (v) => v === 'cpv' ? <Tag color="blue">CPV</Tag> : v === 'sales' ? <Tag color="purple">Sales</Tag> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      render: (v) => v ? new Date(v).toLocaleDateString() : '—',
    },
    {
      title: 'Actions',
      render: (_, row) => (
        <Space wrap>
          <Button size="small" onClick={() => toggleActive(row._id)} danger={row.isActive}>
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
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Typography.Title level={3} style={{ margin: 0 }}>Employees</Typography.Title>
          <Typography.Text type="secondary">Manage your agency's employees.</Typography.Text>
        </Col>
        <Col>
          <Button type="primary" onClick={() => { addForm.resetFields(); setAddOpen(true); }}>
            Add Employee
          </Button>
        </Col>
      </Row>

      <Table size="small" rowKey="_id" loading={loading} dataSource={employees} columns={columns} />

      {/* Add modal */}
      <Modal title="Add Employee" open={addOpen} onCancel={() => setAddOpen(false)} onOk={addEmployee} okText="Add" confirmLoading={addSaving} destroyOnClose>
        <Form form={addForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="Full name" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Email is required' }, { type: 'email', message: 'Enter a valid email' }]}>
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
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="Full name" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Email is required' }, { type: 'email', message: 'Enter a valid email' }]}>
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
          <Form.Item name="password" label="New Password" rules={[{ required: true, message: 'Password is required' }, { min: 6, message: 'Minimum 6 characters' }]}>
            <Input.Password placeholder="New password" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default Employees;
