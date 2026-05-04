import { useEffect, useState } from 'react';
import { Button, Table, Modal, Form, Select, InputNumber, Input, Space, Popconfirm, Typography, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../api/client';

const PRODUCTS = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'loan', label: 'Loan' },
];

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

function CommissionRules() {
  const [rules, setRules] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [r, b] = await Promise.all([api.get('/commission-rules'), api.get('/banks')]);
      setRules(r.data);
      setBanks(b.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); form.resetFields(); setOpen(true); };
  const openEdit = (rule) => {
    setEditing(rule);
    form.setFieldsValue({ ...rule, bank: rule.bank?._id || null });
    setOpen(true);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/commission-rules/${editing._id}`, values);
        message.success('Rule updated');
      } else {
        await api.post('/commission-rules', values);
        message.success('Rule created');
      }
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/commission-rules/${id}`);
      message.success('Rule deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const columns = [
    { title: 'Product', dataIndex: 'productType', render: (v) => PRODUCTS.find((p) => p.value === v)?.label },
    {
      title: 'Bank',
      dataIndex: ['bank', 'name'],
      render: (v) => v || <Typography.Text type="secondary">All banks (default)</Typography.Text>,
    },
    {
      title: 'Amount per Approval',
      dataIndex: 'amount',
      align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>{aed(v)}</span>,
    },
    {
      title: 'Tier',
      dataIndex: 'tier',
      render: (v) => v ? <Tag>{v}</Tag> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Actions',
      width: 200,
      render: (_, row) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          <Popconfirm title="Delete this rule?" onConfirm={() => onDelete(row._id)}>
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Commission Rules</Typography.Title>
          <Typography.Text type="secondary">
            Set the AED payout per approved lead for each product/bank pair. Leave bank blank for a default.
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Rule</Button>
      </div>

      <Table rowKey="_id" loading={loading} dataSource={rules} columns={columns} />

      <Modal
        title={editing ? 'Edit Rule' : 'Add Rule'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText="Save"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="productType" label="Product" rules={[{ required: true }]}>
            <Select options={PRODUCTS} placeholder="Select product" />
          </Form.Item>
          <Form.Item name="bank" label="Bank (leave blank for default)">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Apply to a specific bank"
              options={banks.map((b) => ({ value: b._id, label: b.name }))}
            />
          </Form.Item>
          <Form.Item name="amount" label="Amount per approval (AED)" rules={[{ required: true }]}>
            <InputNumber min={0} step={50} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="tier" label="Tier label (optional)">
            <Input placeholder="e.g. Tier A" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default CommissionRules;
