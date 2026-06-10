import { useEffect, useState } from 'react';
import {
  Button, Table, Modal, Form, Input, InputNumber, Select, Space,
  Popconfirm, Typography, Tag, message, Divider, Tabs,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined, SearchOutlined } from '@ant-design/icons';
import QuillEditor from '../../components/QuillEditor';
import api from '../../api/client';


const pct = (n) => `${Number(n || 0)}%`;

const LOAN_CATEGORIES = [
  { value: 'personal',  label: 'Personal Loan' },
  { value: 'mortgage',  label: 'Mortgage Loan' },
  { value: 'investor',  label: 'Investor Loan' },
  { value: 'business',  label: 'Business Loan' },
  { value: 'auto_loan', label: 'Auto Loan' },
  { value: 'buyout',    label: 'Buyout Loan' },
  { value: 'fresh',     label: 'Fresh Loan' },
  { value: 'pdc',       label: 'PDC Loans' },
  { value: 'stl',       label: 'STL Loan' },
];

const CATEGORY_COLOR = {
  personal:  'cyan',
  mortgage:  'purple',
  investor:  'gold',
  business:  'blue',
  auto_loan: 'green',
  buyout:    'volcano',
  fresh:     'lime',
  pdc:       'geekblue',
  stl:       'orange',
};

function LoanProducts() {
  const [loans, setLoans] = useState([]);
  const [banks, setBanks] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loanSearch, setLoanSearch] = useState('');
  const [bankFilter, setBankFilter] = useState(null);
  const [agencyFilter, setAgencyFilter] = useState(null);
  const [benefitsHtml, setBenefitsHtml] = useState('');
  const [feesHtml, setFeesHtml] = useState('');
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

  const openCreate = () => { setEditing(null); form.resetFields(); setBenefitsHtml(''); setFeesHtml(''); setOpen(true); };
  const openEdit = (l) => {
    setEditing(l);
    form.setFieldsValue({
      name: l.name,
      loanCategory: l.loanCategory,
      bank: l.bank?._id,
      agency: l.agency?._id,
      isActive: l.isActive,
      commissionBrackets: l.commissionBrackets || [],
      interestRateRange: l.interestRateRange,
      minSalary: l.minSalary,
      maxLoanAmount: l.maxLoanAmount,
      maxTenure: l.maxTenure,
      keyNotes: l.keyNotes,
    });
    setBenefitsHtml(l.benefits || '');
    setFeesHtml(l.feesEligibility || '');
    setOpen(true);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      const payload = { ...values, benefits: benefitsHtml, feesEligibility: feesHtml };
      if (editing) {
        await api.put(`/loan-products/${editing._id}`, payload);
        message.success('Loan product updated');
      } else {
        await api.post('/loan-products', payload);
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
      render: (v) => {
        const cat = LOAN_CATEGORIES.find((c) => c.value === v);
        return <Tag color={CATEGORY_COLOR[v] || 'default'}>{cat?.label || v}</Tag>;
      },
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
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Loan Products</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Loan</Button>
        </div>
      </div>

      <div className="leads-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Input
          allowClear
          placeholder="Search loan name..."
          prefix={<SearchOutlined />}
          value={loanSearch}
          onChange={(e) => setLoanSearch(e.target.value)}
          style={{ width: 260, flexShrink: 0, borderRadius: 6 }}
        />
        <Select
          allowClear
          placeholder="All Banks"
          value={bankFilter}
          onChange={setBankFilter}
          options={banks.map((b) => ({ value: b._id, label: b.name }))}
          style={{ width: 180, flexShrink: 0, borderRadius: 6 }}
        />
        <Select
          allowClear
          placeholder="All Agencies"
          value={agencyFilter}
          onChange={setAgencyFilter}
          options={agencies.map((a) => ({ value: a._id, label: a.name }))}
          style={{ width: 180, flexShrink: 0 }}
        />
      </div>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <Table size="small" rowKey="_id" loading={loading} dataSource={loans.filter((l) => {
          if (loanSearch.trim() && !l.name.toLowerCase().includes(loanSearch.trim().toLowerCase())) return false;
          if (bankFilter && l.bank?._id !== bankFilter) return false;
          if (agencyFilter && l.agency?._id !== agencyFilter) return false;
          return true;
        })} columns={columns} />
      </div>

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

          <Divider orientation="left" style={{ fontSize: 13 }}>Bank Product Info</Divider>
          <Form.Item name="interestRateRange" label="Interest Rate Range">
            <Input placeholder="e.g. 5.99% – 18.99% reducing" />
          </Form.Item>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="maxTenure" label="Max Tenure" style={{ flex: 1 }}>
              <Input placeholder="e.g. Up to 48 months" />
            </Form.Item>
            <Form.Item name="maxLoanAmount" label="Max Loan Amount" style={{ flex: 1 }}>
              <Input placeholder="e.g. Up to AED 2M" />
            </Form.Item>
          </Space>
          <Form.Item name="keyNotes" label="Key Notes">
            <Input.TextArea rows={2} placeholder="Key product notes..." />
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

          <Divider orientation="left" style={{ fontSize: 13 }}>Product Content</Divider>
          <Tabs
            items={[
              {
                key: 'benefits',
                label: 'Product Benefits',
                children: (
                  <QuillEditor
                    value={benefitsHtml}
                    onChange={setBenefitsHtml}
                    style={{ height: 260, marginBottom: 42 }}
                  />
                ),
              },
              {
                key: 'fees',
                label: 'Fees & Eligibility',
                children: (
                  <QuillEditor
                    value={feesHtml}
                    onChange={setFeesHtml}
                    style={{ height: 260, marginBottom: 42 }}
                  />
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </>
  );
}

export default LoanProducts;
