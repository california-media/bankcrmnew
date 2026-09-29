import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Row, Col, Tooltip, Typography } from 'antd';
import { EditOutlined, UserAddOutlined, TableOutlined, AppstoreOutlined, PoweroffOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../../api/client';

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

const ReferralCode = ({ code }) => (
  code
    ? <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#7C3AED', background: '#f3e8ff', padding: '2px 8px', borderRadius: 6 }}>{code}</span>
    : <Typography.Text type="secondary">—</Typography.Text>
);

function Agents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('table');

  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [addSaving, setAddSaving] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm] = Form.useForm();
  const [editSaving, setEditSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/agents-managed');
      setAgents(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (id) => {
    try {
      await api.patch(`/agents-managed/${id}/toggle`);
      message.success('Status updated');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update');
    }
  };

  const addAgent = async () => {
    const values = await addForm.validateFields();
    setAddSaving(true);
    try {
      await api.post('/agents-managed', values);
      message.success('Agent added');
      setAddOpen(false);
      addForm.resetFields();
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to add agent');
    } finally {
      setAddSaving(false);
    }
  };

  const openEdit = (row) => {
    setEditTarget(row);
    editForm.setFieldsValue({ name: row.name, email: row.email, phone: row.phone });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    const values = await editForm.validateFields();
    setEditSaving(true);
    try {
      await api.patch(`/agents-managed/${editTarget._id}`, values);
      message.success('Agent updated');
      setEditOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setEditSaving(false);
    }
  };

  const columns = [
    {
      title: <ColHead>Name</ColHead>,
      dataIndex: 'name',
      render: (v) => <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{v || '—'}</span>,
    },
    {
      title: <ColHead>Email</ColHead>,
      dataIndex: 'email',
      render: (v) => <span style={{ fontSize: 13, color: '#334155' }}>{v}</span>,
    },
    {
      title: <ColHead>Phone</ColHead>,
      dataIndex: 'phone',
      render: (v) => <span style={{ fontSize: 13, color: '#334155' }}>{v || '—'}</span>,
    },
    {
      title: <ColHead>Referral Code</ColHead>,
      dataIndex: 'referralCode',
      render: (v) => <ReferralCode code={v} />,
    },
    {
      title: <ColHead>Status</ColHead>,
      dataIndex: 'isActive',
      width: 100,
      render: (v) => <StatusBadge active={v} />,
    },
    {
      title: <ColHead>Created</ColHead>,
      dataIndex: 'createdAt',
      width: 100,
      render: (v) => <span style={{ fontSize: 12, color: '#64748b' }}>{v ? new Date(v).toLocaleDateString() : '—'}</span>,
    },
    {
      title: <ColHead>Actions</ColHead>,
      width: 120,
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Tooltip title={row.isActive ? 'Deactivate' : 'Activate'}>
            <button
              onClick={() => toggleActive(row._id)}
              style={{
                width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: row.isActive ? '#fef2f2' : '#f0fdf4',
                color: row.isActive ? '#ef4444' : '#22c55e',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
              }}
            >
              {row.isActive ? <PoweroffOutlined /> : <CheckCircleOutlined />}
            </button>
          </Tooltip>
          <Tooltip title="Edit">
            <button
              onClick={() => openEdit(row)}
              style={{
                width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#f3e8ff', color: '#7C3AED',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
              }}
            >
              <EditOutlined />
            </button>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Agents</h2>
        <Space wrap>
          <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>Table</Button>
          <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} onClick={() => setViewMode('card')}>Cards</Button>
          <Button type="primary" icon={<UserAddOutlined />} onClick={() => { addForm.resetFields(); setAddOpen(true); }}>
            Add Agent
          </Button>
        </Space>
      </div>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
        Agents you create here are tagged to your agency — their disbursed leads earn your agency an extra commission on top of what the agent earns.
      </Typography.Text>

      {viewMode === 'table' ? (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflowX: 'auto' }}>
          <Table
            size="small"
            rowKey="_id"
            loading={loading}
            dataSource={agents}
            columns={columns}
            tableLayout="fixed"
            scroll={{ x: 'max-content' }}
            onRow={() => ({ style: { cursor: 'default' } })}
          />
        </div>
      ) : (
        <Row gutter={[14, 14]}>
          {agents.map((row) => (
            <Col key={row._id} xs={24} sm={12} lg={8}>
              <div
                className="lead-card"
                style={{
                  borderRadius: 16, border: '1px solid #e8eaf6', height: '100%',
                  background: '#ffffff', padding: '20px',
                  boxShadow: '0 4px 20px rgba(124,58,237,0.08), 0 1px 4px rgba(124,58,237,0.05)',
                  transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: 'linear-gradient(135deg, #7C3AED 0%, #8b5cf6 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                      {(row.name || row.email || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', lineHeight: 1.3 }}>{row.name || '—'}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{row.email}</div>
                    </div>
                  </div>
                  <StatusBadge active={row.isActive} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>Phone: {row.phone || '—'}</div>
                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    Referral Code: <ReferralCode code={row.referralCode} />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                  <Tooltip title={row.isActive ? 'Deactivate' : 'Activate'}>
                    <button
                      onClick={() => toggleActive(row._id)}
                      style={{
                        width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: row.isActive ? '#fef2f2' : '#f0fdf4',
                        color: row.isActive ? '#ef4444' : '#22c55e',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                        transition: 'background 0.15s',
                      }}
                    >
                      {row.isActive ? <PoweroffOutlined /> : <CheckCircleOutlined />}
                    </button>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <button
                      onClick={() => openEdit(row)}
                      style={{
                        width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: '#f3e8ff', color: '#7C3AED',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                        transition: 'background 0.15s',
                      }}
                    >
                      <EditOutlined />
                    </button>
                  </Tooltip>
                  <div style={{ fontSize: 11, color: '#b0b8c8', marginLeft: 'auto' }}>
                    Joined {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}
                  </div>
                </div>
              </div>
            </Col>
          ))}
          {agents.length === 0 && (
            <Col span={24}><div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0' }}>No agents yet.</div></Col>
          )}
        </Row>
      )}

      {/* Add modal */}
      <Modal title="Add Agent" open={addOpen} onCancel={() => setAddOpen(false)} onOk={addAgent} okText="Add" confirmLoading={addSaving} destroyOnClose>
        <Form form={addForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="Full name" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
            <Input placeholder="email@example.com" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Password is required' }]}>
            <Input.Password placeholder="Password" />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input placeholder="e.g. 0501234567" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit modal */}
      <Modal title="Edit Agent" open={editOpen} onCancel={() => setEditOpen(false)} onOk={saveEdit} okText="Save" confirmLoading={editSaving} destroyOnClose>
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="Full name" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true }, { type: 'email' }]}>
            <Input placeholder="email@example.com" />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input placeholder="e.g. 0501234567" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default Agents;
