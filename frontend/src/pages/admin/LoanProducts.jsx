import { useEffect, useState } from 'react';
import {
  Button, Table, Modal, Form, Input, InputNumber, Select, Space,
  Popconfirm, Typography, Tag, message, Divider,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons';
import api from '../../api/client';

const pct = (n) => `${Number(n || 0)}%`;

const LOAN_CATEGORIES = [
  { value: 'personal', label: 'Personal Loan' },
  { value: 'mortgage', label: 'Mortgage' },
];

function LoanProducts() {
  const [loans, setLoans] = useState([]);
  const [banks, setBanks] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [loansRes, banksRes, agenciesRes] = await Promise.all([
        api.get('/loan-products'),
        api.get('/banks'),
        api.get('/agencies'),
      ]);
      setLoans(loansRes.data);
      setBanks(banksRes.data);
      setAgencies(agenciesRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); form.resetFields(); setOpen(true); };
  const openEdit = (l) => {
    setEditing(l);
    form.setFieldsValue({
      name: l.name,
      loanCategory: l.loanCategory,
      bank: l.bank?._id,
      agency: l.agency?._id,
      isActive: l.isActive,
      commissionBrackets: l.commissionBrackets || [],
    });
    setOpen(true);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/loan-products/${editing._id}`, values);
        message.success('Loan product updated');
      } else {
        await api.post('/loan-products', values);
        message.success('Loan product created');
      }
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/loan-products/${id}`);
      message.success('Loan product deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const bankOptions = banks.map((b) => ({ value: b._id, label: b.name }));
  const agencyOptions = agencies.map((a) => ({ value: a._id, label: a.name || a.email }));

  const columns = [
    { title: 'Loan Name', dataIndex: 'name', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    {
      title: 'Category',
      dataIndex: 'loanCategory',
      render: (v) => <Tag color={v === 'mortgage' ? 'purple' : 'cyan'}>{v === 'mortgage' ? 'Mortgage' : 'Personal Loan'}</Tag>,
    },
    { title: 'Bank', render: (_, row) => row.bank?.name || '—' },
    { title: 'Agency', render: (_, row) => row.agency?.name || row.agency?.email || '—' },
    {
      title: 'Brackets',
      render: (_, row) => {
        const b = row.commissionBrackets || [];
        if (!b.length) return <Typography.Text type="secondary">—</Typography.Text>;
        return (
          <Space direction="vertical" size={2}>
            {b.map((br, i) => (
              <Typography.Text key={i} style={{ fontSize: 12 }}>
                ≥ AED {Number(br.minimumSalary).toLocaleString()} → R: {pct(br.receivable)} / P: {pct(br.payable)}
              </Typography.Text>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      render: (v) => v ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>,
    },
    {
      title: 'Actions',
      width: 200,
      render: (_, row) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          <Popconfirm title="Delete this loan product?" onConfirm={() => onDelete(row._id)}>
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
          <Typography.Title level={3} style={{ margin: 0 }}>Loan Products</Typography.Title>
          <Typography.Text type="secondary">
            Manage loan products. Commission brackets define receivable and payable rates (% of loan amount) per salary tier.
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Loan</Button>
      </div>

      <Table size="small" rowKey="_id" loading={loading} dataSource={loans} columns={columns} />

      <Modal
        title={editing ? 'Edit Loan Product' : 'Add Loan Product'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText="Save"
        destroyOnClose
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Loan Name" rules={[{ required: true, message: 'Loan name is required' }]}>
            <Input placeholder="e.g. Emirates NBD Personal Loan" />
          </Form.Item>
          <Form.Item name="loanCategory" label="Loan Category" rules={[{ required: true, message: 'Loan category is required' }]}>
            <Select options={LOAN_CATEGORIES} placeholder="Select category" />
          </Form.Item>
          <Form.Item name="bank" label="Bank" rules={[{ required: true, message: 'Bank is required' }]}>
            <Select
              showSearch
              options={bankOptions}
              placeholder="Select bank"
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="agency" label="Agency" rules={[{ required: true, message: 'Agency is required' }]}>
            <Select
              showSearch
              options={agencyOptions}
              placeholder="Select agency"
              filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13 }}>Commission Brackets</Divider>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
            Receivable = % of loan amount agency receives from bank. Payable = % of loan amount paid to agent. Highest eligible bracket applies.
          </Typography.Text>

          <Form.List name="commissionBrackets">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }} wrap>
                    <Form.Item
                      {...restField}
                      name={[name, 'minimumSalary']}
                      label="Min Salary (AED)"
                      rules={[{ required: true, message: 'Required' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber min={0} step={500} placeholder="5000" style={{ width: 130 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'receivable']}
                      label="Receivable (%)"
                      rules={[{ required: true, message: 'Required' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber min={0} max={100} step={0.1} placeholder="2.0" style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'payable']}
                      label="Payable (%)"
                      rules={[{ required: true, message: 'Required' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber min={0} max={100} step={0.1} placeholder="1.2" style={{ width: 120 }} />
                    </Form.Item>
                    <MinusCircleOutlined
                      onClick={() => remove(name)}
                      style={{ color: '#ff4d4f', marginTop: 28, cursor: 'pointer' }}
                    />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                  Add Bracket
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </>
  );
}

export default LoanProducts;
