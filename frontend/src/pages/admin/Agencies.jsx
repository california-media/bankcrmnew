import { useEffect, useState } from 'react';
import { Button, Table, Modal, Form, Input, Tag, Typography, message, Alert, Tooltip, Popconfirm, Space } from 'antd';
import { PlusOutlined, MailOutlined, CopyOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import api from '../../api/client';

function Agencies() {
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/agencies');
      setAgencies(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { form.resetFields(); setInviteUrl(null); setOpen(true); };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      const { data } = await api.post('/agencies', values);
      message.success('Agency invited');
      if (data.inviteUrl) setInviteUrl(data.inviteUrl);
      else setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to create agency');
    }
  };

  const onResend = async (id) => {
    try {
      const { data } = await api.post(`/agencies/${id}/resend-invite`);
      message.success('Invite resent');
      if (data.inviteUrl) {
        Modal.info({
          title: 'Invite Link (dev)',
          content: <Typography.Text copyable>{data.inviteUrl}</Typography.Text>,
        });
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    }
  };

  const openEdit = (row) => {
    setEditTarget(row);
    editForm.setFieldsValue({ name: row.name || '', email: row.email });
  };

  const onEdit = async () => {
    const values = await editForm.validateFields();
    try {
      await api.patch(`/agencies/${editTarget._id}`, values);
      message.success('Agency updated');
      setEditTarget(null);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update');
    }
  };

  const onToggleActive = async (row) => {
    try {
      await api.patch(`/agencies/${row._id}/toggle-active`);
      message.success(row.isActive ? 'Agency deactivated' : 'Agency activated');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/agencies/${id}`);
      message.success('Agency deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', render: (v) => v || <Typography.Text type="secondary">—</Typography.Text> },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Status',
      dataIndex: 'isActive',
      render: (v) => v ? <Tag color="green">Active</Tag> : <Tag color="orange">Pending invite</Tag>,
    },
    {
      title: 'Actions',
      render: (_, row) => (
        <Space>
          {!row.isActive && (
            <Tooltip title="Resend invite link">
              <Button size="small" icon={<MailOutlined />} onClick={() => onResend(row._id)}>Resend</Button>
            </Tooltip>
          )}
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
            title="Delete agency?"
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Agencies</Typography.Title>
          <Typography.Text type="secondary">
            Each agency manages their own banks and commission rules after activating.
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Invite Agency</Button>
      </div>
      <Table size="small" rowKey="_id" loading={loading} dataSource={agencies} columns={columns} />

      <Modal
        title="Invite Agency"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={inviteUrl ? () => setOpen(false) : onSubmit}
        okText={inviteUrl ? 'Done' : 'Send invite'}
        destroyOnClose
      >
        {inviteUrl ? (
          <Alert
            type="success"
            showIcon
            message="Invite created"
            description={
              <>
                <p style={{ marginTop: 0 }}>SMTP isn't configured, so share this link manually:</p>
                <Typography.Paragraph copyable={{ icon: <CopyOutlined /> }} style={{ wordBreak: 'break-all' }}>
                  {inviteUrl}
                </Typography.Paragraph>
              </>
            }
          />
        ) : (
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="Agency name (optional)">
              <Input placeholder="They can also set this themselves on activation" />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input />
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Modal
        title="Edit Agency"
        open={!!editTarget}
        onCancel={() => setEditTarget(null)}
        onOk={onEdit}
        okText="Save"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="Agency name">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default Agencies;
