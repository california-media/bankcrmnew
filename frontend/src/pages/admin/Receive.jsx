import { useEffect, useMemo, useState } from 'react';
import {
  Table, Tag, Typography, Button, Input, Tabs, Space, message, Popconfirm, Row, Col, Statistic, Card, Modal, Form,
} from 'antd';
import { SearchOutlined, InboxOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

export default function Receive() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('pending');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const [noteModal, setNoteModal] = useState(false);
  const [noteTarget, setNoteTarget] = useState(null); // null = all
  const [noteForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads');
      setLeads(data.filter((l) => l.grossCommission > 0));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markReceived = async (leadIds, note) => {
    setSaving(true);
    try {
      const body = {};
      if (leadIds) body.leadIds = leadIds;
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (tab === 'pending' && l.agencyPaymentStatus !== 'pending') return false;
      if (tab === 'received' && l.agencyPaymentStatus !== 'received') return false;
      if (q && !l.customerName.toLowerCase().includes(q) && !(l.leadNumber || '').toLowerCase().includes(q)
        && !(l.agency?.name || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [leads, search, tab]);

  const pendingLeads = useMemo(() => leads.filter((l) => l.agencyPaymentStatus === 'pending'), [leads]);
  const receivedLeads = useMemo(() => leads.filter((l) => l.agencyPaymentStatus === 'received'), [leads]);

  const stats = useMemo(() => ({
    pendingCount: pendingLeads.length,
    pendingAmount: pendingLeads.reduce((s, l) => s + (l.grossCommission || 0), 0),
    receivedCount: receivedLeads.length,
    receivedAmount: receivedLeads.reduce((s, l) => s + (l.grossCommission || 0), 0),
  }), [pendingLeads, receivedLeads]);

  const selectedPending = useMemo(
    () => selectedRowKeys.filter((id) => pendingLeads.some((l) => l._id === id)),
    [selectedRowKeys, pendingLeads],
  );

  const columns = [
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
          <div style={{ fontSize: 12, color: '#888' }}>{row.phone}</div>
        </div>
      ),
    },
    {
      title: 'Agency',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.agency?.name || '—'}</div>
          {row.agency?.email && <div style={{ fontSize: 12, color: '#888' }}>{row.agency.email}</div>}
        </div>
      ),
    },
    { title: 'Bank', render: (_, row) => row.bank?.name || '—' },
    {
      title: 'Lead Stage',
      dataIndex: 'status',
      render: (s) => {
        const map = { draft: 'default', submitted: 'blue', under_review: 'gold', assigned: 'cyan', approved: 'green', rejected: 'red', disbursed: 'purple' };
        const label = { draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review', assigned: 'Assigned', approved: 'Approved', rejected: 'Rejected', disbursed: 'Disbursed' };
        return <Tag color={map[s]}>{label[s] || s}</Tag>;
      },
    },
    {
      title: 'Gross Commission',
      align: 'right',
      render: (_, row) => <span style={{ fontWeight: 700, fontSize: 14 }}>{aed(row.grossCommission)}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'agencyPaymentStatus',
      render: (s, row) => (
        <Space direction="vertical" size={0}>
          <Tag color={s === 'received' ? 'green' : 'orange'}>{s === 'received' ? 'Received' : 'Pending'}</Tag>
          {s === 'received' && row.agencyPaymentReceivedAt && (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {new Date(row.agencyPaymentReceivedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
            </Typography.Text>
          )}
          {s === 'received' && row.agencyPaymentNote && (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>{row.agencyPaymentNote}</Typography.Text>
          )}
        </Space>
      ),
    },
    ...(tab === 'pending' ? [{
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
    }] : []),
  ];

  const tabItems = [
    { key: 'pending', label: `Pending (${stats.pendingCount})` },
    { key: 'received', label: `Received (${stats.receivedCount})` },
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
            {selectedPending.length > 0 && (
              <Button type="primary" icon={<InboxOutlined />} onClick={() => openNoteModal(selectedPending)}>
                Mark Received ({selectedPending.length} selected)
              </Button>
            )}
            {stats.pendingCount > 0 && (
              <Popconfirm
                title={`Mark all ${stats.pendingCount} pending payments as received?`}
                onConfirm={() => markReceived(null, null)}
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
          <Card>
            <Statistic
              title="Pending from Agencies"
              value={aed(stats.pendingAmount)}
              valueStyle={{ color: '#d97706', fontWeight: 700 }}
              suffix={<Typography.Text type="secondary" style={{ fontSize: 13 }}>{stats.pendingCount} leads</Typography.Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Received"
              value={aed(stats.receivedAmount)}
              valueStyle={{ color: '#16a34a', fontWeight: 700 }}
              suffix={<Typography.Text type="secondary" style={{ fontSize: 13 }}>{stats.receivedCount} leads</Typography.Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Gross Commission"
              value={aed(stats.pendingAmount + stats.receivedAmount)}
              valueStyle={{ fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={tab}
        onChange={(k) => { setTab(k); setSelectedRowKeys([]); }}
        items={tabItems}
        style={{ marginBottom: 8 }}
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
        scroll={{ x: 'max-content' }}
        rowSelection={
          tab === 'pending'
            ? { selectedRowKeys, onChange: setSelectedRowKeys }
            : undefined
        }
        onRow={(row) => ({ onClick: () => navigate(`/admin/leads/${row._id}`), style: { cursor: 'pointer' } })}
      />

      <Modal
        title="Mark as Received"
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
          {noteTarget ? `Marking ${noteTarget.length} lead(s) as payment received from agency.` : 'Marking all pending as received.'}
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
