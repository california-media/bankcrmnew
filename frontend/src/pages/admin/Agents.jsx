import { useEffect, useState } from 'react';
import { Table, Typography, Tag, Button, Modal, Form, Input, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

function AdminAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

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
      title: 'Joined',
      dataIndex: 'createdAt',
      render: (d) => new Date(d).toLocaleDateString(),
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

      <Table rowKey="_id" loading={loading} dataSource={agents} columns={columns} />

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
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
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
    </>
  );
}

export default AdminAgents;
