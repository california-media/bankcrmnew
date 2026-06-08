import { useEffect, useState } from 'react';
import {
  Table, Tag, Typography, Button, Modal, Space, message, Badge,
} from 'antd';
import { EyeOutlined, DeleteOutlined, MailOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import api from '../../api/client';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;

export default function Inquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/inquiries');
      setInquiries(data);
    } catch {
      message.error('Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const open = async (record) => {
    setSelected(record);
    if (!record.read) {
      try {
        await api.patch(`/inquiries/${record._id}/read`);
        setInquiries((prev) =>
          prev.map((i) => (i._id === record._id ? { ...i, read: true } : i))
        );
      } catch {}
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/inquiries/${id}`);
      message.success('Deleted');
      setInquiries((prev) => prev.filter((i) => i._id !== id));
      if (selected?._id === id) setSelected(null);
    } catch {
      message.error('Failed to delete');
    }
  };

  const unreadCount = inquiries.filter((i) => !i.read).length;

  const columns = [
    {
      title: '',
      dataIndex: 'read',
      width: 8,
      render: (read) =>
        read ? null : <Badge color="#4f46e5" />,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      render: (name, r) => (
        <Space>
          <Text strong={!r.read}>{name}</Text>
          {!r.read && <Tag color="blue" style={{ fontSize: 10 }}>New</Tag>}
        </Space>
      ),
    },
    { title: 'Email',   dataIndex: 'email' },
    { title: 'Phone',   dataIndex: 'phone',       render: (v) => v || '—' },
    { title: 'Company', dataIndex: 'companyName',  render: (v) => v || '—' },
    {
      title: 'Received',
      dataIndex: 'createdAt',
      render: (v) => dayjs(v).fromNow(),
    },
    {
      title: '',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => open(record)} />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() =>
              Modal.confirm({
                title: 'Delete inquiry?',
                onOk: () => remove(record._id),
              })
            }
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 20 }}>
        <MailOutlined style={{ fontSize: 22, color: '#4f46e5' }} />
        <Title level={4} style={{ margin: 0 }}>
          Site Inquiries
          {unreadCount > 0 && (
            <Badge count={unreadCount} style={{ marginLeft: 10, backgroundColor: '#4f46e5' }} />
          )}
        </Title>
      </Space>

      <Table
        rowKey="_id"
        dataSource={inquiries}
        columns={columns}
        loading={loading}
        rowClassName={(r) => (!r.read ? 'inquiry-unread' : '')}
        pagination={{ pageSize: 20 }}
        onRow={(record) => ({ onClick: () => open(record), style: { cursor: 'pointer' } })}
      />

      <Modal
        open={!!selected}
        onCancel={() => setSelected(null)}
        footer={[
          <Button
            key="del"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: 'Delete inquiry?',
                onOk: () => remove(selected._id),
              });
            }}
          >
            Delete
          </Button>,
          <Button key="close" onClick={() => setSelected(null)}>Close</Button>,
        ]}
        title={
          <Space>
            <MailOutlined />
            {selected?.name}
            <Text type="secondary" style={{ fontSize: 12 }}>
              {selected && dayjs(selected.createdAt).format('DD MMM YYYY, HH:mm')}
            </Text>
          </Space>
        }
      >
        {selected && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text><strong>Email:</strong> <a href={`mailto:${selected.email}`}>{selected.email}</a></Text>
            {selected.phone    && <Text><strong>Phone:</strong> {selected.phone}</Text>}
            {selected.companyName && <Text><strong>Company:</strong> {selected.companyName}</Text>}
            {selected.message && (
              <>
                <Text strong>Message:</Text>
                <Paragraph style={{ background: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 0 }}>
                  {selected.message}
                </Paragraph>
              </>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
}
