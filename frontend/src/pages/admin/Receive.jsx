import { useEffect, useMemo, useState } from 'react';
import {
  Table, Tag, Typography, Button, Input, Tabs, Space, message, Popconfirm, Row, Col, Card, Modal, Form,
} from 'antd';
import {
  SearchOutlined, InboxOutlined, ClockCircleOutlined, CheckCircleOutlined, BarChartOutlined, FileOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;
const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export default function Receive() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('pending');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const [noteModal, setNoteModal] = useState(false);
  const [noteTarget, setNoteTarget] = useState(null); // array of IDs or null = all
  const [noteForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads');
      setLeads(data.filter((l) => l.status === 'disbursed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markReceived = async (leadIds, note) => {
    setSaving(true);
    try {
      const body = { leadIds };
      if (note) body.note = note;
      const { data } = await api.post('/leads/bulk-mark-received', body);
      message.success(`${data.count} payment(s) marked as received`);
      setSelectedRowKeys([]);
      setNoteModal(false);
      noteForm.resetFields();
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const openNoteModal = (leadIds) => {
    setNoteTarget(leadIds);
    noteForm.resetFields();
    setNoteModal(true);
  };

  // Tab 1: disbursed, agency hasn't submitted payment yet
  const pendingLeads = useMemo(
    () => leads.filter((l) => l.agencyPaymentStatus === 'pending'),
    [leads],
  );
  // Tab 2: agency submitted payment, admin hasn't confirmed yet
  const receiptLeads = useMemo(
    () => leads.filter((l) => l.agencyPaymentStatus === 'agency_paid'),
    [leads],
  );
  // Tab 3: admin confirmed received
  const confirmedLeads = useMemo(
    () => leads.filter((l) => l.agencyPaymentStatus === 'received'),
    [leads],
  );

  const stats = useMemo(() => ({
    pendingCount:   pendingLeads.length,
    pendingAmount:  pendingLeads.reduce((s, l) => s + (l.grossCommission || 0), 0),
    receiptCount:   receiptLeads.length,
    receiptAmount:  receiptLeads.reduce((s, l) => s + (l.grossCommission || 0), 0),
    confirmedCount: confirmedLeads.length,
    confirmedAmount:confirmedLeads.reduce((s, l) => s + (l.grossCommission || 0), 0),
  }), [pendingLeads, receiptLeads, confirmedLeads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base;
    if (tab === 'pending')   base = pendingLeads;
    else if (tab === 'receipt') base = receiptLeads;
    else base = confirmedLeads;
    if (!q) return base;
    return base.filter((l) =>
      l.customerName.toLowerCase().includes(q) ||
      (l.leadNumber || '').toLowerCase().includes(q) ||
      (l.agency?.name || '').toLowerCase().includes(q),
    );
  }, [leads, search, tab, pendingLeads, receiptLeads, confirmedLeads]);

  const selectedReceipt = useMemo(
    () => selectedRowKeys.filter((id) => receiptLeads.some((l) => l._id === id)),
    [selectedRowKeys, receiptLeads],
  );

  const baseColumns = [
    {
      title: 'Lead ID',
      dataIndex: 'leadNumber',
      render: (v) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{v || '—'}</Typography.Text>,
    },
    {
      title: 'Client',
      dataIndex: 'customerName',
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{row.phone}</div>
        </div>
      ),
    },
    {
      title: 'Agency',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.agency?.name || '—'}</div>
          {row.agency?.email && <div style={{ fontSize: 12, color: '#94a3b8' }}>{row.agency.email}</div>}
        </div>
      ),
    },
    { title: 'Bank', render: (_, row) => row.bank?.name || '—' },
    {
      title: 'Gross Commission',
      align: 'right',
      render: (_, row) => <span style={{ fontWeight: 700, fontSize: 14 }}>{aed(row.grossCommission)}</span>,
    },
  ];

  const receiptColumn = {
    title: 'Agency Receipt',
    render: (_, row) => {
      if (!row.disbursementReceiptAt) return <Typography.Text type="secondary">—</Typography.Text>;
      return (
        <Space direction="vertical" size={0}>
          {row.disbursementReceipt && (
            <Typography.Text style={{ fontSize: 12, fontFamily: 'monospace' }}>{row.disbursementReceipt}</Typography.Text>
          )}
          {row.disbursementReceiptFile && (
            <a
              href={`${API_BASE}/uploads/receipts/${row.disbursementReceiptFile}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <FileOutlined /> View file
            </a>
          )}
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {new Date(row.disbursementReceiptAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
          </Typography.Text>
        </Space>
      );
    },
  };

  const confirmedColumn = {
    title: 'Confirmed',
    render: (_, row) => (
      <Space direction="vertical" size={0}>
        <Tag color="green">Received</Tag>
        {row.agencyPaymentReceivedAt && (
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {new Date(row.agencyPaymentReceivedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
          </Typography.Text>
        )}
        {row.agencyPaymentNote && (
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>{row.agencyPaymentNote}</Typography.Text>
        )}
      </Space>
    ),
  };

  const actionColumn = {
    title: 'Action',
    render: (_, row) => (
      <Button
        size="small"
        type="primary"
        icon={<InboxOutlined />}
        onClick={(e) => { e.stopPropagation(); openNoteModal([row._id]); }}
      >
        Mark Received
      </Button>
    ),
  };

  const columns =
    tab === 'pending'  ? [...baseColumns] :
    tab === 'receipt'  ? [...baseColumns, receiptColumn, actionColumn] :
                         [...baseColumns, confirmedColumn];

  const tabItems = [
    {
      key: 'pending',
      label: <span><ClockCircleOutlined style={{ color: '#d97706', marginRight: 5 }} />Pending ({stats.pendingCount})</span>,
    },
    {
      key: 'receipt',
      label: <span><InboxOutlined style={{ color: '#2563eb', marginRight: 5 }} />Received ({stats.receiptCount})</span>,
    },
    {
      key: 'confirmed',
      label: <span><CheckCircleOutlined style={{ color: '#16a34a', marginRight: 5 }} />Marked Received ({stats.confirmedCount})</span>,
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Typography.Title level={3} style={{ margin: 0 }}>Receive</Typography.Title>
          <Typography.Text type="secondary">Track commission payments received from agencies.</Typography.Text>
        </Col>
        <Col>
          <Space>
            {tab === 'receipt' && selectedReceipt.length > 0 && (
              <Button type="primary" icon={<InboxOutlined />} onClick={() => openNoteModal(selectedReceipt)}>
                Mark Received ({selectedReceipt.length} selected)
              </Button>
            )}
            {tab === 'receipt' && stats.receiptCount > 0 && (
              <Popconfirm
                title={`Mark all ${stats.receiptCount} receipt(s) as confirmed received?`}
                onConfirm={() => openNoteModal(receiptLeads.map((l) => l._id))}
                okText="Confirm"
              >
                <Button icon={<InboxOutlined />} loading={saving}>
                  Mark All Received
                </Button>
              </Popconfirm>
            )}
          </Space>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            style={{ borderRadius: 12, borderLeft: '4px solid #f59e0b', background: '#fffbeb', border: '1px solid #f59e0b22' }}
            styles={{ body: { padding: '18px 20px' } }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#b45309', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ClockCircleOutlined /> Awaiting Receipt
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#92400e', lineHeight: 1.2 }}>{aed(stats.pendingAmount)}</div>
            <div style={{ fontSize: 12, color: '#b45309', marginTop: 6, opacity: 0.8 }}>{stats.pendingCount} lead{stats.pendingCount !== 1 ? 's' : ''} — no agency receipt yet</div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            style={{ borderRadius: 12, borderLeft: '4px solid #2563eb', background: '#eff6ff', border: '1px solid #2563eb22' }}
            styles={{ body: { padding: '18px 20px' } }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#1d4ed8', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <InboxOutlined /> Receipt Submitted
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#1e40af', lineHeight: 1.2 }}>{aed(stats.receiptAmount)}</div>
            <div style={{ fontSize: 12, color: '#2563eb', marginTop: 6, opacity: 0.8 }}>{stats.receiptCount} lead{stats.receiptCount !== 1 ? 's' : ''} — awaiting your confirmation</div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            style={{ borderRadius: 12, borderLeft: '4px solid #22c55e', background: '#f0fdf4', border: '1px solid #22c55e22' }}
            styles={{ body: { padding: '18px 20px' } }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#16a34a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircleOutlined /> Confirmed Received
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#15803d', lineHeight: 1.2 }}>{aed(stats.confirmedAmount)}</div>
            <div style={{ fontSize: 12, color: '#16a34a', marginTop: 6, opacity: 0.8 }}>{stats.confirmedCount} payment{stats.confirmedCount !== 1 ? 's' : ''} confirmed → agent payout ready</div>
          </Card>
        </Col>
      </Row>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '0 24px 24px' }}>
        <Tabs
          activeKey={tab}
          onChange={(k) => { setTab(k); setSelectedRowKeys([]); }}
          items={tabItems}
          style={{ marginBottom: 0 }}
        />
        <Space style={{ marginBottom: 16 }}>
          <Input
            allowClear
            placeholder="Search client, lead ID, or agency..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 300 }}
          />
          <Typography.Text type="secondary">{filtered.length} records</Typography.Text>
        </Space>
        <Table
          size="small"
          rowKey="_id"
          loading={loading}
          dataSource={filtered}
          columns={columns}
          rowSelection={
            tab === 'receipt'
              ? { selectedRowKeys, onChange: setSelectedRowKeys }
              : undefined
          }
          onRow={(row) => ({ onClick: () => navigate(`/admin/leads/${row._id}`), style: { cursor: 'pointer' } })}
        />
      </div>

      <Modal
        title="Confirm Payment Received"
        open={noteModal}
        onCancel={() => { setNoteModal(false); noteForm.resetFields(); }}
        onOk={async () => {
          const { note } = noteForm.getFieldsValue();
          await markReceived(noteTarget, note || undefined);
        }}
        okText="Confirm"
        confirmLoading={saving}
        destroyOnClose
      >
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Confirming payment received from agency for {noteTarget?.length} lead(s). This will mark the agent commission as payable.
        </Typography.Text>
        <Form form={noteForm} layout="vertical">
          <Form.Item name="note" label="Note (optional)">
            <Input placeholder="e.g. Bank transfer ref TXN-2025-001" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
