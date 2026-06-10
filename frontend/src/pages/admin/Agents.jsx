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
      width: 52, height: 52, borderRadius: '50%',
      background: '#6366f1',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 17, fontWeight: 700, color: '#fff',
      letterSpacing: 0.5, flexShrink: 0,
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
          <div style={{ fontWeight: 500, fontSize: 14, color: '#0f172a' }}>{row.name || '—'}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{row.email}</div>
          {row.phone && <div style={{ fontSize: 11, color: '#64748b' }}>{row.phone}</div>}
        </div>
      ),
    },
    {
      title: <ColHead>Agent Code</ColHead>,
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
      width: 120,
      render: (_, row) => (
        <Space size={4} style={{ flexWrap: 'nowrap' }}>
          <Tooltip title="View">
            <Button size="small" type="text" icon={<EyeOutlined />} onClick={() => navigate(`/admin/agents/${row._id}`)} style={{ color: '#64748b' }} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} style={{ color: '#64748b' }} />
          </Tooltip>
          <Tooltip title={row.isActive ? 'Deactivate' : 'Activate'}>
            <Button size="small" type="text" icon={row.isActive ? <StopOutlined /> : <CheckCircleOutlined />} onClick={() => onToggleActive(row)} style={{ color: row.isActive ? '#f59e0b' : '#16a34a' }} />
          </Tooltip>
          <Popconfirm title="Delete agent?" description="This cannot be undone." onConfirm={() => onDelete(row._id)} okText="Delete" okButtonProps={{ danger: true }}>
            <Tooltip title="Delete">
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Agents</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>Table</Button>
          <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} onClick={() => setViewMode('card')}>Cards</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setOpen(true); }}>
            Add Agent
          </Button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
          <Table size="small" rowKey="_id" loading={loading} dataSource={agents} columns={columns} />
        </div>
      ) : (
        <Row gutter={[14, 14]}>
          {agents.map((row) => (
            <Col key={row._id} xs={24} sm={12} lg={8}>
              <div style={{
                borderRadius: 16,
                border: '1px solid #e0e2f7',
                background: '#fff',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(99,102,241,0.08), 0 1px 3px rgba(99,102,241,0.05)',
                transition: 'box-shadow 0.2s, transform 0.2s',
                cursor: 'pointer',
              }}
                onClick={() => navigate(`/admin/agents/${row._id}`)}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 28px rgba(99,102,241,0.18)'; e.currentTarget.style.transform = 'translateY(-1.5px)'; e.currentTarget.style.borderColor = '#a5b4fc'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(99,102,241,0.08), 0 1px 3px rgba(99,102,241,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#e0e2f7'; }}
              >
                <div style={{ padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <AgentAvatar name={row.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 16, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.name || '—'}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>✉</span>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Agency tag */}
                  {row.agency?.name && (
                    <div style={{ display: 'inline-flex' }}>
                      <span style={{ fontSize: 12, color: '#6366f1', background: '#f0f0ff', border: '1px solid #e0e0ff', borderRadius: 20, padding: '2px 12px', fontWeight: 500 }}>
                        {row.agency.name}
                      </span>
                    </div>
                  )}

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'Leads', value: row.stats?.total || 0 },
                      { label: 'Pending', value: row.stats?.pending || 0 },
                      { label: 'Paid', value: row.stats?.approved || 0 },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ background: '#fafbff', border: '1px solid #ebebf8', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: 22, color: '#0f172a', lineHeight: 1, marginBottom: 6 }}>{value}</div>
                        <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: 0.8, fontWeight: 600 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div style={{ borderTop: '1px solid #f1f5f9', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 13, color: '#94a3b8' }}>Earnings</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#4f46e5', marginLeft: 8 }}>{aed(row.stats?.paidCommission)}</span>
                  </div>
                  <Space size={4} onClick={e => e.stopPropagation()}>
                    <Tooltip title="Edit">
                      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} style={{ color: '#64748b' }} />
                    </Tooltip>
                    <Tooltip title={row.isActive ? 'Deactivate' : 'Activate'}>
                      <Button size="small" type="text" icon={row.isActive ? <StopOutlined /> : <CheckCircleOutlined />} onClick={() => onToggleActive(row)} style={{ color: row.isActive ? '#f59e0b' : '#16a34a' }} />
                    </Tooltip>
                    <Popconfirm title="Delete agent?" description="This cannot be undone." onConfirm={() => onDelete(row._id)} okText="Delete" okButtonProps={{ danger: true }}>
                      <Tooltip title="Delete"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
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
