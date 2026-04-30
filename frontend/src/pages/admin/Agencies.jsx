import { useEffect, useState } from 'react';
import { Button, Table, Modal, Form, Input, Select, Tag, Typography, message, Alert, Tooltip } from 'antd';
import { PlusOutlined, MailOutlined, CopyOutlined } from '@ant-design/icons';
import api from '../../api/client';

function Agencies() {
  const [agencies, setAgencies] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([api.get('/agencies'), api.get('/banks')]);
      setAgencies(a.data);
      setBanks(b.data);
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
      else { setOpen(false); }
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

  const columns = [
    { title: 'Name', dataIndex: 'name', render: (v) => v || <Typography.Text type="secondary">—</Typography.Text> },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Banks',
      dataIndex: 'banks',
      render: (banks) => (banks || []).map((b) => <Tag key={b._id}>{b.name}</Tag>),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      render: (v) => v ? <Tag color="green">Active</Tag> : <Tag color="orange">Pending invite</Tag>,
    },
    {
      title: 'Actions',
      render: (_, row) =>
        !row.isActive && (
          <Tooltip title="Resend invite link">
            <Button icon={<MailOutlined />} onClick={() => onResend(row._id)}>Resend</Button>
          </Tooltip>
        ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Agencies</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Invite Agency</Button>
      </div>
      <Table rowKey="_id" loading={loading} dataSource={agencies} columns={columns} />

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
              <Input placeholder="They can also set this themselves" />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="banks" label="Assign banks" rules={[{ required: true, message: 'Select at least one bank' }]}>
              <Select
                mode="multiple"
                placeholder="Select banks"
                options={banks.map((b) => ({ label: b.name, value: b._id }))}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </>
  );
}

export default Agencies;
