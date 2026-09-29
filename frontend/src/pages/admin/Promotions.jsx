import { useEffect, useState } from 'react';
import { Tabs, Table, Button, Modal, Form, Input, InputNumber, Switch, Tag, Select, DatePicker, message, Popconfirm, Space, Typography, Radio } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api/client';

const STATUS_COLORS = { earned: 'gold', sent: 'blue', redeemed: 'green' };
const PRODUCT_TYPE_LABELS = { credit_card: 'Cards', loan: 'Loans', account: 'Accounts' };
const PRODUCT_TYPE_OPTIONS = [
  { value: 'credit_card', label: 'Cards' },
  { value: 'loan', label: 'Loans' },
  { value: 'account', label: 'Accounts' },
];

function windowLabel(tier) {
  if (tier?.windowType === 'months' && tier.windowMonths) {
    return `Last ${tier.windowMonths} month${tier.windowMonths > 1 ? 's' : ''}`;
  }
  return 'Lifetime';
}

function productTypesLabel(tier) {
  const types = tier?.productTypes?.length ? tier.productTypes : ['credit_card'];
  return types.map((t) => PRODUCT_TYPE_LABELS[t] || t).join(' + ');
}

function TiersTab() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/promotions/tiers');
      setTiers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, productTypes: ['credit_card', 'loan', 'account'] });
    setOpen(true);
  };

  const openEdit = (tier) => {
    setEditing(tier);
    form.setFieldsValue({
      ...tier,
      windowType: tier.windowType || 'lifetime',
      productTypes: tier.productTypes?.length ? tier.productTypes : ['credit_card'],
    });
    setOpen(true);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    if (values.windowType !== 'months') values.windowMonths = undefined;
    try {
      if (editing) await api.put(`/promotions/tiers/${editing._id}`, values);
      else await api.post('/promotions/tiers', values);
      message.success(editing ? 'Tier updated' : 'Tier created');
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    }
  };

  const toggleActive = async (tier) => {
    try {
      await api.put(`/promotions/tiers/${tier._id}`, { isActive: !tier.isActive });
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/promotions/tiers/${id}`);
      message.success('Tier deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed — deactivate it instead if it has already been awarded');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Threshold', dataIndex: 'threshold', render: (v) => `${v} items` },
    { title: 'Products', render: (_, row) => <Tag color="cyan">{productTypesLabel(row)}</Tag> },
    { title: 'Window', render: (_, row) => <Tag color={row.windowType === 'months' ? 'blue' : 'purple'}>{windowLabel(row)}</Tag> },
    { title: 'Reward', dataIndex: 'rewardTitle' },
    { title: 'Description', dataIndex: 'rewardDescription', render: (v) => v || <Typography.Text type="secondary">—</Typography.Text> },
    {
      title: 'Created', dataIndex: 'createdAt',
      render: (v) => v ? new Date(v).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    },
    {
      title: 'Last Edited', dataIndex: 'updatedAt',
      render: (v) => v ? new Date(v).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    },
    {
      title: 'Status',
      render: (_, row) => (
        <Switch checked={row.isActive} checkedChildren="Active" unCheckedChildren="Inactive" onChange={() => toggleActive(row)} />
      ),
    },
    {
      title: 'Actions',
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          <Popconfirm title="Delete this tier?" onConfirm={() => onDelete(row._id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Each tier picks which products count (cards, loans, accounts — any combination) and its own counting window: Lifetime (all-time, never resets) or a rolling number of calendar months. Once an agent crosses a tier, it's earned for good even if a rolling window later moves past those items.
      </Typography.Text>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Tier</Button>
      </div>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <Table size="small" rowKey="_id" loading={loading} dataSource={tiers} columns={columns} locale={{ emptyText: 'No promotion tiers yet' }} scroll={{ x: 'max-content' }} />
      </div>

      <Modal title={editing ? 'Edit Tier' : 'Add Tier'} open={open} onCancel={() => setOpen(false)} onOk={onSubmit} okText="Save" destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ windowType: 'lifetime', productTypes: ['credit_card', 'loan', 'account'] }}>
          <Form.Item name="name" label="Internal Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. Tier 1" />
          </Form.Item>
          <Form.Item name="productTypes" label="Counts Toward" rules={[{ required: true, message: 'Pick at least one product type' }]}>
            <Select mode="multiple" options={PRODUCT_TYPE_OPTIONS} placeholder="Select product types" />
          </Form.Item>
          <Form.Item name="threshold" label="Items Required" rules={[{ required: true, message: 'Threshold is required' }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="windowType" label="Counting Window">
            <Radio.Group>
              <Radio.Button value="lifetime">Lifetime</Radio.Button>
              <Radio.Button value="months">Rolling months</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.windowType !== cur.windowType}>
            {({ getFieldValue }) => getFieldValue('windowType') === 'months' && (
              <Form.Item
                name="windowMonths"
                label="Number of Months"
                rules={[{ required: true, message: 'Enter how many months' }]}
                tooltip="e.g. 2 = current month + previous month, shifting forward every month"
              >
                <InputNumber style={{ width: '100%' }} min={1} placeholder="e.g. 2" />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item name="rewardTitle" label="Reward Title" rules={[{ required: true, message: 'Reward title is required' }]}>
            <Input placeholder="e.g. Movie Ticket Voucher" />
          </Form.Item>
          <Form.Item name="rewardDescription" label="Reward Description">
            <Input.TextArea rows={2} placeholder="e.g. 2 tickets at VOX Cinemas" />
          </Form.Item>
          <Form.Item name="isActive" label="Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function AwardsTab() {
  const [achievedMonth, setAchievedMonth] = useState(null); // null = all-time, no filter
  const [statusFilter, setStatusFilter] = useState(null);
  const [awards, setAwards] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (achievedMonth) params.month = achievedMonth.format('YYYY-MM');
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/promotions/awards', { params });
      setAwards(data.awards);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [achievedMonth, statusFilter]);

  const setStatus = async (id, status) => {
    try {
      await api.put(`/promotions/awards/${id}/status`, { status });
      message.success(`Marked as ${status}`);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  const columns = [
    { title: 'Agent', render: (_, row) => row.agent?.name || row.agent?.email || '—' },
    { title: 'Tier', render: (_, row) => row.tier?.name || '—' },
    { title: 'Products', render: (_, row) => row.tier ? productTypesLabel(row.tier) : '—' },
    { title: 'Window', render: (_, row) => row.tier ? windowLabel(row.tier) : '—' },
    { title: 'Reward', render: (_, row) => row.tier?.rewardTitle || '—' },
    { title: 'Count at Award', dataIndex: 'cardCount' },
    {
      title: 'Achieved In', dataIndex: 'month',
      render: (v) => v ? new Date(`${v}-01`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—',
    },
    {
      title: 'Status', dataIndex: 'status',
      render: (v) => <Tag color={STATUS_COLORS[v] || 'default'}>{v.toUpperCase()}</Tag>,
    },
    {
      title: 'Fulfilled By', render: (_, row) => row.fulfilledBy?.name || row.fulfilledBy?.email || <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Actions',
      render: (_, row) => (
        <Space>
          {row.status === 'earned' && (
            <Button size="small" onClick={() => setStatus(row._id, 'sent')}>Mark Sent</Button>
          )}
          {row.status !== 'redeemed' && (
            <Button size="small" type="primary" onClick={() => setStatus(row._id, 'redeemed')}>Mark Redeemed</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Every reward any agent has ever earned (lifetime). Filter below by the month it was actually achieved, if needed.
      </Typography.Text>
      <Space style={{ marginBottom: 16 }} wrap>
        <DatePicker
          picker="month"
          placeholder="Achieved in (all-time)"
          value={achievedMonth}
          onChange={setAchievedMonth}
          allowClear
        />
        <Select
          allowClear
          placeholder="All statuses"
          style={{ width: 160 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'earned', label: 'Earned' },
            { value: 'sent', label: 'Sent' },
            { value: 'redeemed', label: 'Redeemed' },
          ]}
        />
        <Typography.Text type="secondary">{awards.length} award{awards.length !== 1 ? 's' : ''}</Typography.Text>
      </Space>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <Table size="small" rowKey="_id" loading={loading} dataSource={awards} columns={columns} locale={{ emptyText: 'No agent has earned a reward yet' }} scroll={{ x: 'max-content' }} />
      </div>
    </>
  );
}

function MonthlyBreakdownTab() {
  const [month, setMonth] = useState(dayjs());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/promotions/monthly-counts', { params: { month: month.format('YYYY-MM') } });
      setRows(data.rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [month]);

  const columns = [
    { title: 'Agent', render: (_, row) => row.agent?.name || row.agent?.email || '—' },
    { title: 'Cards', dataIndex: 'credit_card' },
    { title: 'Loans', dataIndex: 'loan' },
    { title: 'Accounts', dataIndex: 'account' },
    { title: 'Total', dataIndex: 'total', sorter: (a, b) => a.total - b.total, defaultSortOrder: 'descend' },
  ];

  return (
    <>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Purely informational — how many of each product type an agent disbursed in a specific month. Has no effect on rewards.
      </Typography.Text>
      <Space style={{ marginBottom: 16 }}>
        <DatePicker picker="month" value={month} onChange={(v) => v && setMonth(v)} allowClear={false} />
      </Space>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <Table size="small" rowKey={(r) => r.agent?._id || Math.random()} loading={loading} dataSource={rows} columns={columns} locale={{ emptyText: 'No cards disbursed this month' }} />
      </div>
    </>
  );
}

function PartnerGuideTab() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/promotions/resources');
      setResources(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    setOpen(true);
  };

  const openEdit = (resource) => {
    setEditing(resource);
    form.setFieldsValue(resource);
    setOpen(true);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) await api.put(`/promotions/resources/${editing._id}`, values);
      else await api.post('/promotions/resources', values);
      message.success(editing ? 'Resource updated' : 'Resource added');
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    }
  };

  const toggleActive = async (resource) => {
    try {
      await api.put(`/promotions/resources/${resource._id}`, { isActive: !resource.isActive });
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/promotions/resources/${id}`);
      message.success('Resource deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const columns = [
    { title: 'Title', dataIndex: 'title', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Description', dataIndex: 'description', render: (v) => v || <Typography.Text type="secondary">—</Typography.Text> },
    {
      title: 'Video Link',
      dataIndex: 'videoLink',
      render: (v) => v ? <a href={v} target="_blank" rel="noopener noreferrer"><LinkOutlined /> Watch</a> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Docs Link',
      dataIndex: 'docsLink',
      render: (v) => v ? <a href={v} target="_blank" rel="noopener noreferrer"><LinkOutlined /> View</a> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Status',
      render: (_, row) => (
        <Switch checked={row.isActive} checkedChildren="Active" unCheckedChildren="Inactive" onChange={() => toggleActive(row)} />
      ),
    },
    {
      title: 'Actions',
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          <Popconfirm title="Delete this resource?" onConfirm={() => onDelete(row._id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Training videos and guideline docs shown to agents on their Promotion page — how to use the portal and earn more incentive.
      </Typography.Text>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Resource</Button>
      </div>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <Table size="small" rowKey="_id" loading={loading} dataSource={resources} columns={columns} locale={{ emptyText: 'No partner resources yet' }} scroll={{ x: 'max-content' }} />
      </div>

      <Modal title={editing ? 'Edit Resource' : 'Add Resource'} open={open} onCancel={() => setOpen(false)} onOk={onSubmit} okText="Save" destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
            <Input placeholder="e.g. Getting Started as a Referral Partner" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Short summary of what this covers" />
          </Form.Item>
          <Form.Item name="videoLink" label="Training Video Link" rules={[{ type: 'url', message: 'Enter a valid URL' }]}>
            <Input placeholder="e.g. https://youtube.com/..." />
          </Form.Item>
          <Form.Item name="docsLink" label="Guideline Docs Link" rules={[{ type: 'url', message: 'Enter a valid URL' }]}>
            <Input placeholder="e.g. https://drive.google.com/..." />
          </Form.Item>
          <Form.Item name="isActive" label="Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function Promotions() {
  return (
    <>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Promotions</h2>
      <Tabs
        items={[
          { key: 'tiers', label: 'Tiers', children: <TiersTab /> },
          { key: 'awards', label: 'Agent Achievements', children: <AwardsTab /> },
          { key: 'monthly', label: 'Monthly Breakdown', children: <MonthlyBreakdownTab /> },
          { key: 'partnerGuide', label: 'Partner Guide', children: <PartnerGuideTab /> },
        ]}
      />
    </>
  );
}

export default Promotions;
