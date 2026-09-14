import { useEffect, useState } from 'react';
import {
  Button, Table, Modal, Form, Input, InputNumber, Select, Space,
  Popconfirm, Typography, Tag, message, Divider, Tabs, Switch, Row, Col,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined, SearchOutlined } from '@ant-design/icons';
import QuillEditor from '../../components/QuillEditor';
import api from '../../api/client';

const ACCOUNT_CATEGORIES = [
  { value: 'business', label: 'Business Account' },
  { value: 'current',  label: 'Current Account' },
  { value: 'savings',  label: 'Saving Account' },
];

const CATEGORY_COLOR = {
  business: 'blue',
  current:  'cyan',
  savings:  'green',
};

function AccountProducts() {
  const [accounts, setAccounts] = useState([]);
  const [banks, setBanks] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [bankFilter, setBankFilter] = useState(null);
  const [agencyFilter, setAgencyFilter] = useState(null);
  const [benefitsHtml, setBenefitsHtml] = useState('');
  const [feesHtml, setFeesHtml] = useState('');
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [accountsRes, banksRes, agenciesRes] = await Promise.all([
        api.get('/account-products'),
        api.get('/banks'),
        api.get('/agencies'),
      ]);
      setAccounts(accountsRes.data);
      setBanks(banksRes.data);
      setAgencies(agenciesRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, agentVisible: true, websiteVisible: true });
    setBenefitsHtml('');
    setFeesHtml('');
    setOpen(true);
  };

  const openEdit = (a) => {
    setEditing(a);
    form.setFieldsValue({
      name: a.name,
      accountCategory: a.accountCategory,
      bank: a.bank?._id,
      agency: a.agency?._id,
      isActive: a.isActive,
      agentVisible: a.agentVisible !== false,
      websiteVisible: a.websiteVisible !== false,
      commissionBrackets: a.commissionBrackets || [],
      minBalance: a.minBalance ?? null,
      monthlyFee: a.monthlyFee || '',
      interestRate: a.interestRate || '',
      type: a.type || undefined,
      digitalOnboarding: a.digitalOnboarding || false,
      multiCurrency: a.multiCurrency || false,
      salaryTransferRequired: a.salaryTransferRequired === true ? 'yes' : a.salaryTransferRequired === false ? 'no' : 'varies',
      freeTransactions: a.freeTransactions || '',
      fallBelowFee: a.fallBelowFee || '',
      payoutFrequency: a.payoutFrequency || '',
      keyNotes: a.keyNotes,
      tags: a.tags || [],
      redirectUrl: a.redirectUrl || '',
      redirectActive: a.redirectActive || false,
    });
    setBenefitsHtml(a.benefits || '');
    setFeesHtml(a.feesEligibility || '');
    setOpen(true);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      const strVal = values.salaryTransferRequired;
      values.salaryTransferRequired = strVal === 'yes' ? true : strVal === 'no' ? false : null;
      const payload = { ...values, benefits: benefitsHtml, feesEligibility: feesHtml };
      if (editing) {
        await api.put(`/account-products/${editing._id}`, payload);
        message.success('Account product updated');
      } else {
        await api.post('/account-products', payload);
        message.success('Account product created');
      }
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/account-products/${id}`);
      message.success('Account product deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const toggleActive = async (row) => {
    try {
      await api.put(`/account-products/${row._id}`, { isActive: !row.isActive });
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  const toggleAgentVisible = async (row) => {
    try {
      await api.put(`/account-products/${row._id}`, { agentVisible: row.agentVisible === false });
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  const toggleWebsiteVisible = async (row) => {
    try {
      await api.put(`/account-products/${row._id}`, { websiteVisible: row.websiteVisible === false });
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  const bankOptions = banks.map((b) => ({ value: b._id, label: b.name }));
  const agencyOptions = agencies.map((a) => ({ value: a._id, label: a.name || a.email }));

  const columns = [
    { title: 'Account Name', dataIndex: 'name', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    {
      title: 'Category',
      dataIndex: 'accountCategory',
      render: (v) => {
        const cat = ACCOUNT_CATEGORIES.find((c) => c.value === v);
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
                ≥ AED {Number(br.minimumSalary).toLocaleString()} → R: AED {br.receivable} / P: AED {br.payable}
              </Typography.Text>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      render: (v, row) => (
        <Switch checked={v} checkedChildren="Active" unCheckedChildren="Inactive" onChange={() => toggleActive(row)} />
      ),
    },
    {
      title: 'Agent Visible',
      dataIndex: 'agentVisible',
      render: (v, row) => (
        <Switch checked={v !== false} checkedChildren="Visible" unCheckedChildren="Hidden" onChange={() => toggleAgentVisible(row)} />
      ),
    },
    {
      title: 'Website Visible',
      dataIndex: 'websiteVisible',
      render: (v, row) => (
        <Switch checked={v !== false} checkedChildren="Visible" unCheckedChildren="Hidden" onChange={() => toggleWebsiteVisible(row)} />
      ),
    },
    {
      title: 'Actions',
      width: 200,
      render: (_, row) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          <Popconfirm title="Delete this account product?" onConfirm={() => onDelete(row._id)}>
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Account Products</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Account</Button>
        </div>
      </div>

      <div className="leads-filter-bar" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Input
          allowClear
          placeholder="Search account name..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
        <Table size="small" rowKey="_id" loading={loading} dataSource={accounts.filter((a) => {
          if (search.trim()) {
            const q = search.trim().toLowerCase();
            if (!a.name.toLowerCase().includes(q) && !(a.bank?.name || '').toLowerCase().includes(q)) return false;
          }
          if (bankFilter && a.bank?._id !== bankFilter) return false;
          if (agencyFilter && a.agency?._id !== agencyFilter) return false;
          return true;
        })} columns={columns} />
      </div>

      <Modal
        title={editing ? 'Edit Account Product' : 'Add Account Product'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText="Save"
        destroyOnClose
        width={780}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Account Name" rules={[{ required: true, message: 'Account name is required' }]}>
            <Input placeholder="e.g. Emirates NBD Business Account" />
          </Form.Item>
          <Form.Item name="accountCategory" label="Account Category" rules={[{ required: true, message: 'Account category is required' }]}>
            <Select options={ACCOUNT_CATEGORIES} placeholder="Select category" />
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
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="minBalance" label="Min Balance (AED)">
                <InputNumber min={0} step={500} style={{ width: '100%' }} placeholder="3000" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="monthlyFee" label="Monthly Fee">
                <Input placeholder="e.g. AED 0 with min balance" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="interestRate" label="Interest Rate">
                <Input placeholder="e.g. up to 3.5% p.a. (savings)" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="type" label="Type">
                <Select allowClear options={[{ value: 'Conventional', label: 'Conventional' }, { value: 'Islamic', label: 'Islamic' }]} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="digitalOnboarding" label="Digital Onboarding" valuePropName="checked" style={{ marginTop: 4 }}>
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="multiCurrency" label="Multi-Currency" valuePropName="checked" style={{ marginTop: 4 }}>
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="salaryTransferRequired" label="Salary Transfer">
                <Select options={[{ value: 'yes', label: 'Required' }, { value: 'no', label: 'Not Required' }, { value: 'varies', label: 'Varies' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="freeTransactions" label="Free Transactions">
                <Input placeholder="e.g. 2 free withdrawals/month" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="fallBelowFee" label="Fee If Below Minimum">
                <Input placeholder="e.g. AED 25/month" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="payoutFrequency" label="Payout Frequency">
                <Input placeholder="e.g. Monthly" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="keyNotes" label="Key Notes">
            <Input.TextArea rows={2} placeholder="Key product notes..." />
          </Form.Item>
          <Form.Item name="tags" label="Tags">
            <Select mode="multiple" options={[{ value: 'fast', label: 'Fast Approval' }, { value: 'national', label: 'UAE Nationals' }]} placeholder="Select tags" />
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13 }}>Commission Brackets</Divider>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
            Receivable = flat AED amount agency receives from bank. Payable = flat AED amount paid to agent. Highest eligible bracket applies.
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
                      label="Receivable (AED)"
                      rules={[{ required: true, message: 'Required' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber min={0} step={50} placeholder="500" style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'payable']}
                      label="Payable (AED)"
                      rules={[{ required: true, message: 'Required' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber min={0} step={50} placeholder="300" style={{ width: 120 }} />
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

          <Divider orientation="left" style={{ fontSize: 13 }}>Redirect Link</Divider>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item name="redirectUrl" label="Redirect URL after submission">
                <Input placeholder="https://app.mysilah.ae/apply/..." />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="redirectActive" label="Redirect Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={5}>
              <Form.Item name="isActive" label="Product Active" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="agentVisible" label="Visible in Agent Panel" valuePropName="checked">
                <Switch checkedChildren="Visible" unCheckedChildren="Hidden" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="websiteVisible" label="Visible in Website" valuePropName="checked">
                <Switch checkedChildren="Visible" unCheckedChildren="Hidden" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ fontSize: 13 }}>Product Content</Divider>
          <Tabs
            items={[
              {
                key: 'benefits',
                label: 'Product Benefits',
                children: (
                  <QuillEditor value={benefitsHtml} onChange={setBenefitsHtml} style={{ height: 260, marginBottom: 42 }} />
                ),
              },
              {
                key: 'fees',
                label: 'Fees & Eligibility',
                children: (
                  <QuillEditor value={feesHtml} onChange={setFeesHtml} style={{ height: 260, marginBottom: 42 }} />
                ),
              },
            ]}
          />
        </Form>
      </Modal>
    </>
  );
}

export default AccountProducts;
