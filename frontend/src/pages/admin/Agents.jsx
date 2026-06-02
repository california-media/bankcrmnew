import { useEffect, useState } from 'react';
import { Table, Typography, Button, Modal, Form, Input, InputNumber, message, Space, Popconfirm, Row, Col, Card, Tag, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, CheckCircleOutlined, TableOutlined, AppstoreOutlined, LockOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const ColHead = ({ children }) => (
  <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.8, textTransform: 'uppercase' }}>{children}</span>
);

const StatusBadge = ({ active }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999,
    background: active ? '#f0fdf4' : '#f8fafc',
    border: `1px solid ${active ? '#bbf7d0' : '#e2e8f0'}`,
    fontSize: 11, fontWeight: 700,
    color: active ? '#15803d' : '#94a3b8',
  }}>
    <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? '#22c55e' : '#94a3b8' }} />
    {active ? 'Active' : 'Inactive'}
  </span>
);

function AdminAgents() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [viewMode, setViewMode] = useState('table');
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  const load = () => {
    setLoading(true);
    api.get('/admin/agents').then((res) => setAgents(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await api.post('/admin/agents', values);
      message.success('Agent created');
      setOpen(false);
      form.resetFields();
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to create agent');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row) => {
    setEditTarget(row);
    editForm.setFieldsValue({ name: row.name, email: row.email, phone: row.phone || '', holdPct: row.holdPct || 0 });
  };

  const onEdit = async () => {
    const values = await editForm.validateFields();
    setSaving(true);
    try {
      await api.patch(`/admin/agents/${editTarget._id}`, values);
      message.success('Agent updated');
      setEditTarget(null);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const onToggleActive = async (row) => {
    try {
      await api.patch(`/admin/agents/${row._id}/toggle-active`);
      message.success(row.isActive ? 'Agent deactivated' : 'Agent activated');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/admin/agents/${id}`);
      message.success('Agent deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const columns = [
    {
      title: <ColHead>Agent</ColHead>,
      render: (_, row) => (
        <div style={{ lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{row.name || '—'}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{row.email}</div>
          {row.phone && <div style={{ fontSize: 11, color: '#64748b' }}>{row.phone}</div>}
        </div>
      ),
    },
    {
      title: <ColHead>Referral Code</ColHead>,
      dataIndex: 'referralCode',
      width: 130,
      render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>{v || '—'}</span>,
    },
    {
      title: <ColHead>Referred By</ColHead>,
      width: 120,
      render: (_, row) => row.referredBy ? (
        <span style={{ fontSize: 12, color: '#334155' }}>{row.referredBy.name || row.referredBy.email}</span>
      ) : <span style={{ color: '#cbd5e1' }}>—</span>,
    },
    {
      title: <ColHead>Leads</ColHead>,
      width: 65,
      align: 'center',
      render: (_, row) => <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{row.stats?.total || 0}</span>,
    },
    {
      title: <ColHead>Approved</ColHead>,
      width: 80,
      align: 'center',
      render: (_, row) => <span style={{ fontWeight: 700, fontSize: 14, color: '#16a34a' }}>{row.stats?.approved || 0}</span>,
    },
    {
      title: <ColHead>Paid</ColHead>,
      width: 110,
      align: 'right',
      render: (_, row) => <span style={{ fontWeight: 700, fontSize: 13, color: '#4f46e5' }}>{aed(row.stats?.paidCommission)}</span>,
    },
    {
      title: <ColHead>Hold %</ColHead>,
      width: 80,
      align: 'center',
      render: (_, row) => row.holdPct > 0
        ? <Tag color="orange" icon={<LockOutlined />} style={{ fontSize: 11 }}>{row.holdPct}%</Tag>
        : <span style={{ color: '#cbd5e1' }}>—</span>,
    },
    {
      title: <ColHead>Status</ColHead>,
      width: 90,
      render: (_, row) => <StatusBadge active={row.isActive} />,
    },
    {
      title: <ColHead>Joined</ColHead>,
      dataIndex: 'createdAt',
      width: 95,
      render: (d) => <span style={{ fontSize: 12, color: '#64748b' }}>{new Date(d).toLocaleDateString()}</span>,
    },
    {
      title: <ColHead>Actions</ColHead>,
      width: 200,
      render: (_, row) => (
        <Space size={6} style={{ flexWrap: 'nowrap' }}>
          <Button
            size="small"
            onClick={() => onToggleActive(row)}
            style={row.isActive
              ? { borderColor: '#ef4444', color: '#ef4444', fontWeight: 600 }
              : { borderColor: '#22c55e', color: '#22c55e', fontWeight: 600 }}
          >
            {row.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/admin/agents/${row._id}`)}>View</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          <Popconfirm
            title="Delete agent?"
            description="This cannot be undone."
            onConfirm={() => onDelete(row._id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Typography.Title level={4} style={{ margin: 0, fontWeight: 500 }}>Agents</Typography.Title>
          <Typography.Text type="secondary">All registered agents and their lead/commission summary.</Typography.Text>
        </Col>
        <Col>
          <Space>
            <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>Table</Button>
            <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} onClick={() => setViewMode('card')}>Cards</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setOpen(true); }}>
              Add Agent
            </Button>
          </Space>
        </Col>
      </Row>

      {viewMode === 'table' ? (
        <Table size="small" rowKey="_id" loading={loading} dataSource={agents} columns={columns} />
      ) : (
        <Row gutter={[14, 14]}>
          {agents.map((row) => (
            <Col key={row._id} xs={24} sm={12} lg={8} xl={6}>
              <Card
                size="small"
                hoverable
                style={{ borderRadius: 12, border: '1px solid #e2e8f0', height: '100%' }}
                styles={{ body: { padding: '16px' } }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{row.name || '—'}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{row.email}</div>
                    {row.phone && <div style={{ fontSize: 11, color: '#64748b' }}>{row.phone}</div>}
                  </div>
                  <StatusBadge active={row.isActive} />
                </div>

                {row.referralCode && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 2 }}>Referral Code</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>{row.referralCode}</div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 0.5 }}>Leads</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{row.stats?.total || 0}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 0.5 }}>Approved</div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#16a34a' }}>{row.stats?.approved || 0}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 0.5 }}>Paid</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#4f46e5' }}>{aed(row.stats?.paidCommission)}</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(row.createdAt).toLocaleDateString()}</span>
                  <Space size={4}>
                    <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
                    <Button
                      size="small"
                      icon={row.isActive ? <StopOutlined /> : <CheckCircleOutlined />}
                      onClick={() => onToggleActive(row)}
                    />
                    <Popconfirm title="Delete agent?" description="This cannot be undone." onConfirm={() => onDelete(row._id)} okText="Delete" okButtonProps={{ danger: true }}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Create modal */}
      <Modal title="Add Agent" open={open} onCancel={() => setOpen(false)} onOk={onSubmit} okText="Create" confirmLoading={saving} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Password is required' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit modal */}
      <Modal title="Edit Agent" open={!!editTarget} onCancel={() => setEditTarget(null)} onOk={onEdit} okText="Save" confirmLoading={saving} destroyOnClose>
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item
            name="holdPct"
            label="Hold Percentage (credit card commissions only)"
            tooltip="% of commission held back until clawback period expires. Set 0 to disable."
          >
            <InputNumber min={0} max={100} formatter={(v) => `${v}%`} parser={(v) => v.replace('%', '')} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default AdminAgents;
