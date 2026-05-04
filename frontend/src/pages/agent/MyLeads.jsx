import { useEffect, useMemo, useState } from 'react';
import {
  Table, Tag, Typography, Button, Input, Select, Row, Col, Space,
  Modal, Form, Empty, Popconfirm, message,
} from 'antd';
import { PlusOutlined, SearchOutlined, SendOutlined, DeleteOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import api from '../../api/client';

const STATUSES = [
  { value: 'draft', label: 'Draft', color: 'default' },
  { value: 'submitted', label: 'Submitted', color: 'blue' },
  { value: 'under_review', label: 'Under Review', color: 'gold' },
  { value: 'assigned', label: 'Assigned', color: 'cyan' },
  { value: 'approved', label: 'Approved', color: 'green' },
  { value: 'rejected', label: 'Rejected', color: 'red' },
  { value: 'disbursed', label: 'Disbursed', color: 'purple' },
];

const PRODUCTS = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'loan', label: 'Loan' },
];

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

function MyLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState();
  const [productFilter, setProductFilter] = useState();

  const [sendOpen, setSendOpen] = useState(false);
  const [sendingLead, setSendingLead] = useState(null);
  const [agencies, setAgencies] = useState([]);
  const [agenciesLoading, setAgenciesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads/mine');
      setLeads(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openSend = async (lead) => {
    setSendingLead(lead);
    setSendOpen(true);
    sendForm.resetFields();
    setAgenciesLoading(true);
    try {
      const { data } = await api.get(`/agencies/for-bank/${lead.bank?._id || lead.bank}`);
      setAgencies(data);
    } finally {
      setAgenciesLoading(false);
    }
  };

  const onSendSubmit = async () => {
    const { agency } = await sendForm.validateFields();
    setSending(true);
    try {
      await api.post(`/leads/${sendingLead._id}/send-to-agency`, { agency });
      message.success('Lead sent to agency');
      setSendOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/leads/${id}`);
      message.success('Draft deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (q && !l.customerName.toLowerCase().includes(q) && !String(l._id).toLowerCase().includes(q)) return false;
      if (statusFilter && l.status !== statusFilter) return false;
      if (productFilter && l.productType !== productFilter) return false;
      return true;
    });
  }, [leads, search, statusFilter, productFilter]);

  const draftCount = leads.filter((l) => l.status === 'draft').length;

  const columns = [
    {
      title: 'Lead ID',
      dataIndex: '_id',
      render: (id) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>LD-{String(id).slice(-6)}</Typography.Text>,
    },
    {
      title: 'Client',
      dataIndex: 'customerName',
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{row.phone}</div>
        </div>
      ),
    },
    { title: 'Product', dataIndex: 'productType', render: (v) => PRODUCTS.find((p) => p.value === v)?.label },
    { title: 'Bank', dataIndex: ['bank', 'name'] },
    { title: 'Agency', render: (_, row) => row.agency?.name || row.agency?.email || <Typography.Text type="secondary">—</Typography.Text> },
    {
      title: 'Stage',
      dataIndex: 'status',
      render: (s) => {
        const meta = STATUSES.find((x) => x.value === s);
        return <Tag color={meta?.color}>{meta?.label || s}</Tag>;
      },
    },
    {
      title: 'Commission',
      dataIndex: 'commission',
      align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>{aed(v)}</span>,
    },
    {
      title: 'Submitted',
      dataIndex: 'createdAt',
      render: (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' }),
    },
    {
      title: 'Actions',
      width: 220,
      render: (_, row) => row.status === 'draft' && (
        <Space>
          <Button size="small" type="primary" icon={<SendOutlined />} onClick={() => openSend(row)}>
            Send to Agency
          </Button>
          <Popconfirm title="Delete this draft?" onConfirm={() => onDelete(row._id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Typography.Title level={3} style={{ margin: 0 }}>My Leads</Typography.Title>
          <Typography.Text type="secondary">
            {leads.length} total leads · Track every case from submission to commission payout.
          </Typography.Text>
        </Col>
        <Col>
          <Link to="/agent/leads/new">
            <Button type="primary" icon={<PlusOutlined />}>New Lead</Button>
          </Link>
        </Col>
      </Row>

      {draftCount > 0 && !statusFilter && (
        <Typography.Text type="warning" style={{ display: 'block', marginTop: 12 }}>
          You have {draftCount} draft {draftCount === 1 ? 'lead' : 'leads'} not yet sent to an agency.
        </Typography.Text>
      )}

      <Space wrap style={{ margin: '24px 0 16px', width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Input
            allowClear
            placeholder="Search by client name or lead ID..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <Select
            allowClear
            placeholder="All Stages"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            style={{ width: 180 }}
          />
          <Select
            allowClear
            placeholder="All Products"
            value={productFilter}
            onChange={setProductFilter}
            options={PRODUCTS}
            style={{ width: 180 }}
          />
        </Space>
        <Typography.Text type="secondary">{filtered.length} leads</Typography.Text>
      </Space>

      <Table rowKey="_id" loading={loading} dataSource={filtered} columns={columns} />

      <Modal
        title="Send Lead to Agency"
        open={sendOpen}
        onCancel={() => setSendOpen(false)}
        onOk={onSendSubmit}
        okText="Send"
        confirmLoading={sending}
        destroyOnClose
      >
        {sendingLead && (
          <>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
              Sending <b>{sendingLead.customerName}</b> ({sendingLead.bank?.name}) to an agency.
              Only agencies that service this bank are listed.
            </Typography.Paragraph>
            <Form form={sendForm} layout="vertical">
              <Form.Item
                name="agency"
                label="Agency"
                rules={[{ required: true, message: 'Pick an agency' }]}
              >
                <Select
                  loading={agenciesLoading}
                  placeholder={agenciesLoading ? 'Loading…' : 'Pick an agency'}
                  notFoundContent={<Empty description="No agencies for this bank" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                  options={agencies.map((a) => ({ value: a._id, label: a.name || a.email }))}
                />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </>
  );
}

export default MyLeads;
