import { useEffect, useState } from 'react';
import {
  Button, Table, Modal, Form, Input, InputNumber, Select, Space,
  Popconfirm, Typography, Tag, message, Divider, Upload, Tabs,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MinusCircleOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import QuillEditor from '../../components/QuillEditor';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const UPLOADS_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace('/api', '/uploads');

const CARD_TYPES = [
  { value: 'regular', label: 'Regular' },
  { value: 'premium', label: 'Premium' },
  { value: 'rewards_lifestyle', label: 'Rewards & Lifestyle' },
  { value: 'travel', label: 'Travel' },
  { value: 'ecommerce', label: 'E-Commerce' },
  { value: 'legacy', label: 'Legacy' },
];

const CARD_TYPE_LABEL = Object.fromEntries(CARD_TYPES.map((t) => [t.value, t.label]));


function CardProducts() {
  const [cards, setCards] = useState([]);
  const [banks, setBanks] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [cardSearch, setCardSearch] = useState('');
  const [fileList, setFileList] = useState([]);
  const [benefitsHtml, setBenefitsHtml] = useState('');
  const [feesHtml, setFeesHtml] = useState('');
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [cardsRes, banksRes, agenciesRes] = await Promise.all([
        api.get('/card-products'),
        api.get('/banks'),
        api.get('/agencies'),
      ]);
      setCards(cardsRes.data);
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
    setFileList([]);
    setBenefitsHtml('');
    setFeesHtml('');
    setOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    form.setFieldsValue({
      name: c.name,
      cardType: c.cardType,
      bank: c.bank?._id,
      agency: c.agency?._id,
      isActive: c.isActive,
      commissionBrackets: c.commissionBrackets || [],
    });
    setBenefitsHtml(c.benefits || '');
    setFeesHtml(c.feesEligibility || '');
    setFileList(
      c.cardImage
        ? [{ uid: '-1', name: c.cardImage, status: 'done', url: `${UPLOADS_BASE}/card-images/${c.cardImage}` }]
        : []
    );
    setOpen(true);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      const fd = new FormData();
      fd.append('name', values.name);
      fd.append('cardType', values.cardType);
      fd.append('bank', values.bank);
      if (values.agency) fd.append('agency', values.agency);
      fd.append('commissionBrackets', JSON.stringify(values.commissionBrackets || []));
      fd.append('benefits', benefitsHtml);
      fd.append('feesEligibility', feesHtml);
      fd.append('isActive', values.isActive !== false ? 'true' : 'false');

      const newFile = fileList.find((f) => f.originFileObj);
      if (newFile) fd.append('cardImage', newFile.originFileObj);

      if (editing) {
        await api.put(`/card-products/${editing._id}`, fd);
        message.success('Card product updated');
      } else {
        await api.post('/card-products', fd);
        message.success('Card product created');
      }
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/card-products/${id}`);
      message.success('Card product deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const bankOptions = banks.map((b) => ({ value: b._id, label: b.name }));
  const agencyOptions = agencies.map((a) => ({ value: a._id, label: a.name || a.email }));

  const columns = [
    {
      title: 'Image',
      width: 70,
      render: (_, row) => row.cardImage
        ? <img src={`${UPLOADS_BASE}/card-images/${row.cardImage}`} alt="" style={{ width: 52, height: 34, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }} />
        : <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>,
    },
    { title: 'Card Name', dataIndex: 'name', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    {
      title: 'Type',
      dataIndex: 'cardType',
      render: (v) => {
        const colors = { regular: 'blue', premium: 'gold', rewards_lifestyle: 'green', travel: 'cyan', ecommerce: 'purple', legacy: 'volcano' };
        return <Tag color={colors[v] || 'default'}>{CARD_TYPE_LABEL[v] || v}</Tag>;
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
                ≥ AED {Number(br.minimumSalary).toLocaleString()} → R: {aed(br.receivable)} / P: {aed(br.payable)}
                {br.feeType && <Tag color={br.feeType === 'free' ? 'green' : 'blue'} style={{ marginLeft: 4, fontSize: 10 }}>{br.feeType === 'free' ? 'Free' : 'Paid'}</Tag>}
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
          <Popconfirm title="Delete this card product?" onConfirm={() => onDelete(row._id)}>
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
          <Typography.Title level={3} style={{ margin: 0 }}>Card Products</Typography.Title>
          <Typography.Text type="secondary">
            Manage credit card products. Commission brackets define receivable and payable amounts per salary tier.
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Card</Button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Input
          allowClear
          placeholder="Search card name..."
          prefix={<SearchOutlined />}
          value={cardSearch}
          onChange={(e) => setCardSearch(e.target.value)}
          style={{ width: 280 }}
        />
      </div>
      <Table
        size="small"
        rowKey="_id"
        loading={loading}
        dataSource={cardSearch.trim() ? cards.filter((c) => c.name.toLowerCase().includes(cardSearch.trim().toLowerCase())) : cards}
        columns={columns}
      />

      <Modal
        title={editing ? 'Edit Card Product' : 'Add Card Product'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText="Save"
        destroyOnClose
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Card Name" rules={[{ required: true, message: 'Card name is required' }]}>
            <Input placeholder="e.g. Emirates NBD Signature Card" />
          </Form.Item>
          <Form.Item name="cardType" label="Card Type" rules={[{ required: true, message: 'Card type is required' }]}>
            <Select options={CARD_TYPES} placeholder="Select card type" />
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

          <Form.Item label="Card Image">
            <Upload
              listType="picture-card"
              fileList={fileList}
              beforeUpload={(file) => {
                setFileList([{ uid: file.uid, name: file.name, status: 'done', originFileObj: file }]);
                return false;
              }}
              onRemove={() => { setFileList([]); return false; }}
              accept=".jpg,.jpeg,.png,.webp"
              maxCount={1}
            >
              {fileList.length === 0 && (
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8, fontSize: 12 }}>Upload</div>
                </div>
              )}
            </Upload>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              JPG, PNG, or WebP — max 10 MB
            </Typography.Text>
          </Form.Item>

          <Divider orientation="left" style={{ fontSize: 13 }}>Commission Brackets</Divider>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
            Receivable = gross commission from bank (AED). Payable = agent commission (AED). Highest eligible bracket applies.
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
                      <InputNumber min={0} step={50} placeholder="800" style={{ width: 130 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'payable']}
                      label="Payable (AED)"
                      rules={[{ required: true, message: 'Required' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber min={0} step={50} placeholder="500" style={{ width: 130 }} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'feeType']}
                      label="Card Fee"
                      initialValue="free"
                      style={{ marginBottom: 0 }}
                    >
                      <Select style={{ width: 100 }} options={[
                        { value: 'free', label: 'Free' },
                        { value: 'paid', label: 'Paid' },
                      ]} />
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

export default CardProducts;
