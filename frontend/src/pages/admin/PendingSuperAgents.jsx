import { useState } from 'react';
import { Button, Table, Alert, Popconfirm, Space, Descriptions, Modal, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import api from '../../api/client';

// Pending super agent sign-ups (self-registered, awaiting admin approval).
function PendingSuperAgents({ pending, loading, onChanged }) {
  const [detailTarget, setDetailTarget] = useState(null);

  const onApprove = async (id) => {
    try {
      await api.patch(`/admin/agencies/${id}/approve`);
      message.success('Super agent approved — they can now login');
      onChanged();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    }
  };

  const onReject = async (id) => {
    try {
      await api.patch(`/admin/agencies/${id}/reject`);
      message.success('Super agent registration rejected');
      onChanged();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    }
  };

  const columns = [
    {
      title: 'Name',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{row.email}</div>
        </div>
      ),
    },
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
          <Popconfirm title="Reject this super agent?" onConfirm={() => onReject(row._id)} okText="Reject" okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<CloseCircleOutlined />}>Reject</Button>
          </Popconfirm>
          <Button size="small" onClick={() => setDetailTarget(row)}>Details</Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      {pending.length === 0 && !loading && (
        <Alert type="info" showIcon message="No pending super agent registrations." style={{ marginBottom: 12 }} />
      )}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <Table
          size="small"
          rowKey="_id"
          loading={loading}
          dataSource={pending}
          columns={columns}
          scroll={{ x: 760 }}
          locale={{ emptyText: 'No pending registrations' }}
        />
      </div>

      <Modal
        title="Super Agent Registration Details"
        open={!!detailTarget}
        onCancel={() => setDetailTarget(null)}
        footer={[
          <Button key="close" onClick={() => setDetailTarget(null)}>Close</Button>,
          <Popconfirm key="reject" title="Reject this super agent?" onConfirm={() => { onReject(detailTarget._id); setDetailTarget(null); }} okText="Reject" okButtonProps={{ danger: true }}>
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
            <Descriptions.Item label="Name">{detailTarget.name || '—'}</Descriptions.Item>
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

export default PendingSuperAgents;
