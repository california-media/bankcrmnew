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
    <span style={{
      width: 5, height: 5, borderRadius: '50%',
      background: active ? '#22c55e' : '#94a3b8',
      boxShadow: active ? '0 0 0 2px #bbf7d0' : 'none',
    }} />
    {active ? 'Active' : 'Inactive'}
  </span>
);

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'linear-gradient(135deg, #3b82f6, #06b6d4)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #10b981, #3b82f6)',
  'linear-gradient(135deg, #ec4899, #8b5cf6)',
  'linear-gradient(135deg, #14b8a6, #6366f1)',
  'linear-gradient(135deg, #f97316, #eab308)',
];

const getGradient = (name = '') =>
  AVATAR_GRADIENTS[(name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];

const AgentAvatar = ({ name }) => {
  const initials = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: 42, height: 42, borderRadius: 12,
      background: getGradient(name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 15, fontWeight: 800, color: '#fff',
      letterSpacing: 0.5, flexShrink: 0,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    }}>
      {initials}
    </div>
  );
};

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
              <div style={{
                borderRadius: 16,
                border: '1px solid #e8edf5',
                background: '#fff',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
                transition: 'box-shadow 0.2s, transform 0.2s',
                cursor: 'default',
              }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.10)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {/* Accent bar */}
                <div style={{ height: 4, background: getGradient(row.name), flexShrink: 0 }} />

                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <AgentAvatar name={row.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.name || '—'}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.email}</div>
                      {row.phone && <div style={{ fontSize: 11, color: '#64748b' }}>{row.phone}</div>}
                    </div>
                    <StatusBadge active={row.isActive} />
                  </div>

                  {/* Referral code */}
                  {row.referralCode && (
                    <div style={{ background: '#f8faff', border: '1px solid #e0e7ff', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 0.8, fontWeight: 600 }}>Referral</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: '#4f46e5', letterSpacing: 1 }}>{row.referralCode}</span>
                    </div>
                  )}

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    {[
                      { label: 'Leads', value: row.stats?.total || 0, color: '#0f172a', bg: '#f8fafc' },
                      { label: 'Approved', value: row.stats?.approved || 0, color: '#16a34a', bg: '#f0fdf4' },
                      { label: 'Paid', value: aed(row.stats?.paidCommission), color: '#4f46e5', bg: '#f5f3ff', small: true },
                    ].map(({ label, value, color, bg, small }) => (
                      <div key={label} style={{ background: bg, borderRadius: 8, padding: '7px 6px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 0.8, fontWeight: 700, marginBottom: 3 }}>{label}</div>
                        <div style={{ fontWeight: 800, fontSize: small ? 11 : 18, color, lineHeight: 1 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div style={{ borderTop: '1px solid #f1f5f9', padding: '9px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc' }}>
                  <span style={{ fontSize: 11, color: '#b0bac9', fontWeight: 500 }}>
                    {new Date(row.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <Space size={4}>
                    <Tooltip title="Edit">
                      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(row)}
                        style={{ color: '#64748b' }} />
                    </Tooltip>
                    <Tooltip title={row.isActive ? 'Deactivate' : 'Activate'}>
                      <Button size="small" type="text"
                        icon={row.isActive ? <StopOutlined /> : <CheckCircleOutlined />}
                        onClick={() => onToggleActive(row)}
                        style={{ color: row.isActive ? '#f59e0b' : '#16a34a' }} />
                    </Tooltip>
                    <Popconfirm title="Delete agent?" description="This cannot be undone." onConfirm={() => onDelete(row._id)} okText="Delete" okButtonProps={{ danger: true }}>
                      <Tooltip title="Delete">
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                      </Tooltip>
                    </Popconfirm>
                  </Space>
                </div>
              </div>
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
