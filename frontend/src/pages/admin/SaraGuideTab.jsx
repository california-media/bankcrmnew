import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Switch, message, Popconfirm, Space, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined } from '@ant-design/icons';
import api from '../../api/client';

// Same check as the backend (saraVideo.controller.js): the mobile app plays YouTube only.
const YOUTUBE_RE = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)[\w-]{11}/i;

/**
 * Admin Promotions > Sara Guide: the mobile app's "Watch how it works" videos (sign-in screen and Learn),
 * separate from the Partner Guide. Active videos play in sort order, then oldest first.
 */
export default function SaraGuideTab() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/sara-videos');
      setVideos(data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, sortOrder: 0 });
    setOpen(true);
  };

  const openEdit = (video) => {
    setEditing(video);
    form.setFieldsValue(video);
    setOpen(true);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) await api.put(`/sara-videos/${editing._id}`, values);
      else await api.post('/sara-videos', values);
      message.success(editing ? 'Video updated' : 'Video added');
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    }
  };

  const toggleActive = async (video) => {
    try {
      await api.put(`/sara-videos/${video._id}`, { isActive: !video.isActive });
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/sara-videos/${id}`);
      message.success('Video deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const columns = [
    { title: 'Order', dataIndex: 'sortOrder', width: 70 },
    { title: 'Title', dataIndex: 'title', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Description', dataIndex: 'description', render: (v) => v || <Typography.Text type="secondary">—</Typography.Text> },
    {
      title: 'Video Link',
      dataIndex: 'videoLink',
      render: (v) => <a href={v} target="_blank" rel="noopener noreferrer"><LinkOutlined /> Watch</a>,
    },
    {
      title: 'Status',
      render: (_, row) => (
        <Switch checked={row.isActive} checkedChildren="Active" unCheckedChildren="Inactive" onChange={() => toggleActive(row)} />
      ),
    },
    {
      title: 'Actions',
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          <Popconfirm title="Delete this video?" onConfirm={() => onDelete(row._id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Sara's guide videos in the MySilah mobile app ("Watch how it works" on the sign-in screen and in Learn).
        Anyone can watch them, even before signing in. YouTube links only, with embedding allowed in the video's YouTube settings.
      </Typography.Text>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Video</Button>
      </div>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <Table size="small" rowKey="_id" loading={loading} dataSource={videos} columns={columns} locale={{ emptyText: 'No Sara guide videos yet' }} scroll={{ x: 'max-content' }} />
      </div>

      <Modal title={editing ? 'Edit Video' : 'Add Video'} open={open} onCancel={() => setOpen(false)} onOk={onSubmit} okText="Save" destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}>
            <Input placeholder="e.g. How to submit a lead" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Short line shown under the video" />
          </Form.Item>
          <Form.Item
            name="videoLink"
            label="YouTube Video Link"
            rules={[
              { required: true, message: 'Video link is required' },
              { pattern: YOUTUBE_RE, message: 'Enter a YouTube video link' },
            ]}
          >
            <Input placeholder="e.g. https://www.youtube.com/watch?v=..." />
          </Form.Item>
          <Form.Item name="sortOrder" label="Order" tooltip="Lower numbers play first">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isActive" label="Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
