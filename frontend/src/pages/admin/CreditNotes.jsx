import { useEffect, useState } from 'react';
import { Button, Table, Modal, Form, Input, Select, InputNumber, Space, Popconfirm, Tag, message, Typography } from 'antd';
import { PlusOutlined, CheckOutlined, StopOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../api/client';

const STATUS_COLORS = { open: 'orange', settled: 'green', cancelled: 'default' };

function CreditNotes() {
  const [notes, setNotes] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/credit-notes');
      setNotes(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get('/agencies').then((res) => setAgencies(res.data)).catch(() => {});
  }, []);

  const agencyOptions = agencies.map((a) => ({ value: a._id, label: a.name || a.email }));

  const openCreate = () => {
    form.resetFields();
    setOpen(true);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      await api.post('/credit-notes', values);
      message.success('Credit note created');
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    }
  };

  const setStatus = async (id, status) => {
    try {
      await api.put(`/credit-notes/${id}/status`, { status });
      message.success(`Credit note marked ${status}`);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/credit-notes/${id}`);
      message.success('Credit note deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const columns = [
    { title: 'Note #', dataIndex: 'noteNumber', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Agency', dataIndex: 'agency', render: (a) => a?.name || a?.email || '—' },
    { title: 'Amount', dataIndex: 'amount', render: (v) => `AED ${Number(v || 0).toLocaleString()}` },
    { title: 'Reason', dataIndex: 'reason', render: (v) => v || <Typography.Text type="secondary">—</Typography.Text> },
    {
      title: 'Status', dataIndex: 'status',
      render: (v) => <Tag color={STATUS_COLORS[v] || 'default'}>{v.toUpperCase()}</Tag>,
    },
    { title: 'Created By', dataIndex: 'createdBy', render: (u) => u?.name || u?.email || '—' },
    {
      title: 'Date', dataIndex: 'createdAt',
      render: (v) => v ? new Date(v).toLocaleDateString() : '—',
    },
    {
      title: 'Actions',
      render: (_, row) => (
        <Space>
          {row.status === 'open' && (
            <>
              <Button size="small" icon={<CheckOutlined />} onClick={() => setStatus(row._id, 'settled')}>Settle</Button>
              <Button size="small" icon={<StopOutlined />} onClick={() => setStatus(row._id, 'cancelled')}>Cancel</Button>
            </>
          )}
          <Popconfirm title="Delete this credit note?" onConfirm={() => onDelete(row._id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Credit Notes</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Credit Note</Button>
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <Table size="small" rowKey="_id" loading={loading} dataSource={notes} columns={columns} scroll={{ x: 'max-content' }} />
      </div>

      <Modal title="Add Credit Note" open={open} onCancel={() => setOpen(false)} onOk={onSubmit} okText="Save" destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="agency" label="Agency" rules={[{ required: true, message: 'Agency is required' }]}>
            <Select showSearch options={agencyOptions} placeholder="Select agency" filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())} />
          </Form.Item>
          <Form.Item name="amount" label="Amount (AED)" rules={[{ required: true, message: 'Amount is required' }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'Reason is required' }]}>
            <Input.TextArea rows={3} placeholder="Why this credit note is being issued" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default CreditNotes;
