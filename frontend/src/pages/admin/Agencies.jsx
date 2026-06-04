import { useEffect, useState } from 'react';
import { Button, Table, Modal, Form, Input, Tag, Typography, message, Alert, Tooltip, Popconfirm, Space, Row, Col, Card, Tabs, Badge, Descriptions } from 'antd';
import { PlusOutlined, MailOutlined, CopyOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, StopOutlined, TableOutlined, AppstoreOutlined, ClockCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import api from '../../api/client';

function Agencies() {
  const [agencies, setAgencies] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [viewMode, setViewMode] = useState('table');
  const [tab, setTab] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/agencies');
      setAgencies(data);
    } finally {
      setLoading(false);
    }
  };

  const loadPending = async () => {
    setPendingLoading(true);
    try {
      const { data } = await api.get('/admin/agencies/pending');
      setPending(data);
    } finally {
      setPendingLoading(false);
    }
  };

  useEffect(() => { load(); loadPending(); }, []);

  const openCreate = () => { form.resetFields(); setInviteUrl(null); setOpen(true); };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      const { data } = await api.post('/agencies', values);
      message.success('Agency invited');
      if (data.inviteUrl) setInviteUrl(data.inviteUrl);
      else setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to create agency');
    }
  };

  const onResend = async (id) => {
    try {
      const { data } = await api.post(`/agencies/${id}/resend-invite`);
      message.success('Invite resent');
      if (data.inviteUrl) {
        Modal.info({
          title: 'Invite Link (dev)',
          content: <Typography.Text copyable>{data.inviteUrl}</Typography.Text>,
        });
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    }
  };

  const openEdit = (row) => {
    setEditTarget(row);
    editForm.setFieldsValue({ name: row.name || '', email: row.email });
  };

  const onEdit = async () => {
    const values = await editForm.validateFields();
    try {
      await api.patch(`/agencies/${editTarget._id}`, values);
      message.success('Agency updated');
      setEditTarget(null);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update');
    }
  };

  const onToggleActive = async (row) => {
    try {
      await api.patch(`/agencies/${row._id}/toggle-active`);
      message.success(row.isActive ? 'Agency deactivated' : 'Agency activated');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/agencies/${id}`);
      message.success('Agency deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const onApprove = async (id) => {
    try {
      await api.patch(`/admin/agencies/${id}/approve`);
      message.success('Agency approved — they can now login');
      loadPending();
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    }
  };

  const onReject = async (id) => {
    try {
      await api.patch(`/admin/agencies/${id}/reject`);
      message.success('Agency registration rejected');
      loadPending();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    }
  };

  const renderActions = (row) => (
    <Space size={4}>
      {!row.isActive && (
        <Tooltip title="Resend invite link">
          <Button size="small" icon={<MailOutlined />} onClick={() => onResend(row._id)}>Resend</Button>
        </Tooltip>
      )}
      <Tooltip title="Edit">
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
      </Tooltip>
      <Tooltip title={row.isActive ? 'Deactivate' : 'Activate'}>
        <Button
          size="small"
          icon={row.isActive ? <StopOutlined /> : <CheckCircleOutlined />}
          onClick={() => onToggleActive(row)}
        />
      </Tooltip>
      <Popconfirm
        title="Delete agency?"
        description="This cannot be undone."
        onConfirm={() => onDelete(row._id)}
        okText="Delete"
        okButtonProps={{ danger: true }}
      >
        <Tooltip title="Delete">
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Tooltip>
      </Popconfirm>
    </Space>
  );

  const columns = [
    { title: 'Name', dataIndex: 'name', render: (v) => v || <Typography.Text type="secondary">—</Typography.Text> },
    { title: 'Email', dataIndex: 'email' },
    {
      title: 'Status',
      dataIndex: 'isActive',
      render: (v) => v ? <Tag color="green">Active</Tag> : <Tag color="orange">Pending invite</Tag>,
    },
    { title: 'Actions', render: (_, row) => renderActions(row) },
  ];

  const pendingColumns = [
    {
      title: 'Company',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.companyName || row.name}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{row.email}</div>
        </div>
      ),
    },
    { title: 'Trade License', dataIndex: 'tradeLicense', render: (v) => v || '—' },
    { title: 'Phone', dataIndex: 'phone', render: (v) => v || '—' },
    { title: 'Location', dataIndex: 'location', render: (v) => v || '—' },
    { title: 'Emirates ID', dataIndex: 'emiratesId', render: (v) => v || '—' },
    {
      title: 'Applied',
      dataIndex: 'createdAt',
      render: (d) => new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    {
      title: 'Actions',
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<CheckCircleOutlined />} onClick={() => onApprove(row._id)} style={{ color: '#16a34a', borderColor: '#16a34a' }}>
            Approve
          </Button>
          <Popconfirm title="Reject this agency?" onConfirm={() => onReject(row._id)} okText="Reject" okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<CloseCircleOutlined />}>Reject</Button>
          </Popconfirm>
          <Button size="small" onClick={() => setDetailTarget(row)}>Details</Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0, fontWeight: 500 }}>Agencies</Typography.Title>
          <Typography.Text type="secondary">
            Each agency manages their own banks and commission rules after activating.
          </Typography.Text>
        </div>
        <Space>
          <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} onClick={() => setViewMode('table')}>Table</Button>
          <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} onClick={() => setViewMode('card')}>Cards</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Invite Agency</Button>
        </Space>
      </div>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'all',
            label: <span>All Agencies ({agencies.length})</span>,
            children: viewMode === 'table' ? (
              <Table size="small" rowKey="_id" loading={loading} dataSource={agencies} columns={columns} />
            ) : (
              <Row gutter={[14, 14]}>
                {agencies.map((row) => (
                  <Col key={row._id} xs={24} sm={12} lg={8} xl={6}>
                    <Card
                      size="small" hoverable
                      style={{ borderRadius: 12, border: '1px solid #e2e8f0', height: '100%' }}
                      styles={{ body: { padding: '14px 16px' } }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                            {row.name || <Typography.Text type="secondary">No name set</Typography.Text>}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{row.email}</div>
                        </div>
                        {row.isActive ? <Tag color="green">Active</Tag> : <Tag color="orange">Pending</Tag>}
                      </div>
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                        {renderActions(row)}
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            ),
          },
          {
            key: 'pending',
            label: (
              <span>
                <ClockCircleOutlined style={{ color: '#f59e0b', marginRight: 5 }} />
                Pending Approval
                {pending.length > 0 && (
                  <Badge count={pending.length} style={{ marginLeft: 8, backgroundColor: '#f59e0b' }} />
                )}
              </span>
            ),
            children: (
              <>
                {pending.length === 0 && !pendingLoading && (
                  <Alert type="info" showIcon message="No pending agency registrations." style={{ marginBottom: 12 }} />
                )}
                <Table
                  size="small"
                  rowKey="_id"
                  loading={pendingLoading}
                  dataSource={pending}
                  columns={pendingColumns}
                  scroll={{ x: 860 }}
                  locale={{ emptyText: 'No pending registrations' }}
                />
              </>
            ),
          },
        ]}
      />

      {/* Invite Modal */}
      <Modal
        title="Invite Agency"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={inviteUrl ? () => setOpen(false) : onSubmit}
        okText={inviteUrl ? 'Done' : 'Send invite'}
        destroyOnClose
      >
        {inviteUrl ? (
          <Alert
            type="success" showIcon message="Invite created"
            description={
              <>
                <p style={{ marginTop: 0 }}>SMTP isn't configured, so share this link manually:</p>
                <Typography.Paragraph copyable={{ icon: <CopyOutlined /> }} style={{ wordBreak: 'break-all' }}>
                  {inviteUrl}
                </Typography.Paragraph>
              </>
            }
          />
        ) : (
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="Agency name (optional)">
              <Input placeholder="They can also set this themselves on activation" />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="Edit Agency"
        open={!!editTarget}
        onCancel={() => setEditTarget(null)}
        onOk={onEdit}
        okText="Save"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="Agency name"><Input /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal for pending agency */}
      <Modal
        title="Agency Registration Details"
        open={!!detailTarget}
        onCancel={() => setDetailTarget(null)}
        footer={[
          <Button key="close" onClick={() => setDetailTarget(null)}>Close</Button>,
          <Popconfirm key="reject" title="Reject this agency?" onConfirm={() => { onReject(detailTarget._id); setDetailTarget(null); }} okText="Reject" okButtonProps={{ danger: true }}>
            <Button danger icon={<CloseCircleOutlined />}>Reject</Button>
          </Popconfirm>,
          <Button key="approve" type="primary" icon={<CheckCircleOutlined />} style={{ background: '#16a34a', borderColor: '#16a34a' }} onClick={() => { onApprove(detailTarget._id); setDetailTarget(null); }}>
            Approve
          </Button>,
        ]}
        width={520}
      >
        {detailTarget && (
          <Descriptions column={1} bordered size="small" style={{ marginTop: 8 }}>
            <Descriptions.Item label="Company Name">{detailTarget.companyName || detailTarget.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Trade License">{detailTarget.tradeLicense || '—'}</Descriptions.Item>
            <Descriptions.Item label="Email">{detailTarget.email}</Descriptions.Item>
            <Descriptions.Item label="Phone">{detailTarget.phone || '—'}</Descriptions.Item>
            <Descriptions.Item label="Emirates ID">{detailTarget.emiratesId || '—'}</Descriptions.Item>
            <Descriptions.Item label="Location">{detailTarget.location || '—'}</Descriptions.Item>
            <Descriptions.Item label="Applied On">{new Date(detailTarget.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </>
  );
}

export default Agencies;
