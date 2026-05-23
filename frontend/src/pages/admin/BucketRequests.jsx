import { useEffect, useState } from 'react';
import {
  Table, Tag, Typography, Button, Modal, Input, Form, Space, message, Tabs,
} from 'antd';
import {
  CheckOutlined, CloseOutlined, WalletOutlined, PaperClipOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api/client';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const STATUS_TAG = {
  pending:  <Tag color="gold">Pending</Tag>,
  approved: <Tag color="green">Approved</Tag>,
  rejected: <Tag color="red">Rejected</Tag>,
};

export default function BucketRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('pending');

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectForm] = Form.useForm();
  const [actioning, setActioning] = useState(null);

  const load = async (status = tab) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/agency-payouts/admin/bucket-requests?status=${status}`);
      setRequests(data);
    } catch {
      message.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(tab); }, [tab]);

  const approve = async (id) => {
    setActioning(id);
    try {
      await api.patch(`/agency-payouts/admin/bucket-requests/${id}/approve`);
      message.success('Approved — wallet credited');
      load(tab);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    } finally {
      setActioning(null);
    }
  };

  const openReject = (record) => {
    rejectForm.resetFields();
    setRejectTarget(record);
    setRejectOpen(true);
  };

  const confirmReject = async () => {
    const { reason } = rejectForm.getFieldsValue();
    setActioning(rejectTarget._id);
    try {
      await api.patch(`/agency-payouts/admin/bucket-requests/${rejectTarget._id}/reject`, { reason });
      message.success('Request rejected');
      setRejectOpen(false);
      setRejectTarget(null);
      load(tab);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    } finally {
      setActioning(null);
    }
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      width: 160,
      render: (v) => dayjs(v).format('DD MMM YYYY, HH:mm'),
    },
    {
      title: 'Agency',
      dataIndex: 'agency',
      render: (a) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{a?.name || a?.email || '—'}</div>
          {a?.name && <div style={{ fontSize: 11, color: '#94a3b8' }}>{a.email}</div>}
        </div>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      align: 'right',
      render: (v) => <Typography.Text strong style={{ color: '#4f46e5' }}>{aed(v)}</Typography.Text>,
    },
    {
      title: 'Note / Receipt',
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          {row.note && <span style={{ fontSize: 12, color: '#475569' }}>{row.note}</span>}
          {row.receiptFile && (
            <a
              href={`${API_BASE}/uploads/receipts/${row.receiptFile}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <PaperClipOutlined /> View receipt
            </a>
          )}
          {!row.note && !row.receiptFile && <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (v) => STATUS_TAG[v] || <Tag>{v}</Tag>,
    },
    ...(tab === 'rejected' ? [{
      title: 'Reason',
      dataIndex: 'rejectionReason',
      render: (v) => v ? <span style={{ fontSize: 12, color: '#dc2626' }}>{v}</span> : <span style={{ color: '#94a3b8' }}>—</span>,
    }] : []),
    ...(tab === 'approved' || tab === 'rejected' ? [{
      title: 'Reviewed By',
      render: (_, row) => (
        <div style={{ fontSize: 12 }}>
          <div>{row.reviewedBy?.name || row.reviewedBy?.email || '—'}</div>
          {row.reviewedAt && <div style={{ color: '#94a3b8', fontSize: 11 }}>{dayjs(row.reviewedAt).format('DD MMM, HH:mm')}</div>}
        </div>
      ),
    }] : []),
    ...(tab === 'pending' ? [{
      title: 'Actions',
      width: 160,
      render: (_, row) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<CheckOutlined />}
            loading={actioning === row._id}
            onClick={() => approve(row._id)}
            style={{ background: '#16a34a', borderColor: '#16a34a' }}
          >
            Approve
          </Button>
          <Button
            size="small"
            danger
            icon={<CloseOutlined />}
            loading={actioning === row._id}
            onClick={() => openReject(row)}
          >
            Reject
          </Button>
        </Space>
      ),
    }] : []),
  ];

  const counts = { pending: 0, approved: 0, rejected: 0 };
  requests.forEach((r) => { if (counts[r.status] !== undefined) counts[r.status]++; });

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0, fontWeight: 700 }}>
          <WalletOutlined style={{ marginRight: 8, color: '#4f46e5' }} />Bucket Top-Up Requests
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Approve or reject agency wallet top-up requests
        </Typography.Text>
      </div>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'pending',  label: `Pending (${tab === 'pending' ? requests.length : '?'})` },
          { key: 'approved', label: 'Approved' },
          { key: 'rejected', label: 'Rejected' },
        ]}
      />

      <Table
        size="small"
        rowKey="_id"
        loading={loading}
        dataSource={requests}
        columns={columns}
        scroll={{ x: 800 }}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        style={{ marginTop: 12 }}
      />

      <Modal
        title="Reject Request"
        open={rejectOpen}
        onCancel={() => { setRejectOpen(false); setRejectTarget(null); }}
        onOk={confirmReject}
        okText="Reject"
        okButtonProps={{ danger: true }}
        confirmLoading={!!actioning}
        destroyOnClose
        width={420}
      >
        {rejectTarget && (
          <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{rejectTarget.agency?.name || rejectTarget.agency?.email}</div>
            <div style={{ fontSize: 13, color: '#ea580c', fontWeight: 700 }}>{aed(rejectTarget.amount)}</div>
          </div>
        )}
        <Form form={rejectForm} layout="vertical">
          <Form.Item name="reason" label="Reason (optional)">
            <Input.TextArea rows={3} placeholder="Reason for rejection shown to agency..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
