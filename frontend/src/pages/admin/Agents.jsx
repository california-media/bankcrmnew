import { useEffect, useState } from 'react';
import { Table, Typography, Tag, Button, Modal, Form, Input, message, Space, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

function AdminAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const load = () => {
    setLoading(true);
    api.get('/admin/agents').then((res) => setAgents(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await api.post('/admin/agents', values);
      message.success('Agent created');
      setOpen(false);
      form.resetFields();
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to create agent');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row) => {
    setEditTarget(row);
    editForm.setFieldsValue({ name: row.name, email: row.email, phone: row.phone || '' });
  };

  const onEdit = async () => {
    const values = await editForm.validateFields();
    setSaving(true);
    try {
      await api.patch(`/admin/agents/${editTarget._id}`, values);
      message.success('Agent updated');
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
      await api.patch(`/admin/agents/${row._id}/toggle-active`);
      message.success(row.isActive ? 'Agent deactivated' : 'Agent activated');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/admin/agents/${id}`);
      message.success('Agent deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v || '—'}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{row.email}</div>
        </div>
      ),
    },
    { title: 'Phone', dataIndex: 'phone', render: (v) => v || '—' },
    {
      title: 'Referral Code',
      dataIndex: 'referralCode',
      render: (v) => <Typography.Text style={{ fontFamily: 'monospace' }}>{v}</Typography.Text>,
    },
    {
      title: 'Referred by',
      dataIndex: 'referredBy',
      render: (v) => v ? <Tag color="blue">{v.name || v.email}</Tag> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    { title: 'Total Leads', dataIndex: ['stats', 'total'] },
    { title: 'Approved', dataIndex: ['stats', 'approved'] },
    {
      title: 'Paid Commission',
      dataIndex: ['stats', 'paidCommission'],
      align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>{aed(v)}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      render: (v) => v ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>,
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      render: (d) => new Date(d).toLocaleDateString(),
    },
    {
      title: 'Actions',
      render: (_, row) => (
        <Space>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          </Tooltip>
          <Tooltip title={row.isActive ? 'Deactivate' : 'Activate'}>
            <Button
              size="small"
              icon={row.isActive ? <StopOutlined /> : <CheckCircleOutlined />}
              onClick={() => onToggleActive(row)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete agent?"
            description="This cannot be undone."
            onConfirm={() => onDelete(row._id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Agents</Typography.Title>
          <Typography.Text type="secondary">All registered agents and their lead/commission summary.</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setOpen(true); }}>
          Add Agent
        </Button>
      </div>

      <Table size="small" rowKey="_id" loading={loading} dataSource={agents} columns={columns} />

      {/* Create modal */}
      <Modal
        title="Add Agent"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText="Create"
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Email is required' }, { type: 'email', message: 'Enter a valid email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Password is required' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit modal */}
      <Modal
        title="Edit Agent"
        open={!!editTarget}
        onCancel={() => setEditTarget(null)}
        onOk={onEdit}
        okText="Save"
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Email is required' }, { type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default AdminAgents;
