// frontend/src/pages/admin/Notices.jsx
import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Switch, Popconfirm,
  Tag, Space, Typography, DatePicker, message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api/client';

const { Title } = Typography;
const { RangePicker } = DatePicker;

const ROLE_COLORS = { admin: 'purple', agency: 'blue', agent: 'cyan', employee: 'orange' };
const ROLE_OPTIONS = [
  { label: 'Admin',    value: 'admin' },
  { label: 'Agency',   value: 'agency' },
  { label: 'Agent',    value: 'agent' },
  { label: 'Employee', value: 'employee' },
];

export default function Notices() {
  const [notices,     setNotices]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [form]                        = Form.useForm();

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notices');
      setNotices(data);
    } catch {
      message.error('Failed to load notices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotices(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      title:       record.title,
      message:     record.message,
      targetRoles: record.targetRoles,
      dateRange:   [dayjs(record.startDate), dayjs(record.endDate)],
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    let values;
    try { values = await form.validateFields(); } catch { return; }

    const [startDate, endDate] = values.dateRange;
    const payload = {
      title:       values.title,
      message:     values.message,
      targetRoles: values.targetRoles,
      startDate:   startDate.toISOString(),
      endDate:     endDate.toISOString(),
      ...(editing ? { isActive: editing.isActive } : {}),
    };

    setSaving(true);
    try {
      if (editing) {
        await api.put(`/notices/${editing._id}`, payload);
        message.success('Notice updated');
      } else {
        await api.post('/notices', payload);
        message.success('Notice created');
      }
      setModalOpen(false);
      fetchNotices();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/notices/${id}`);
      message.success('Deleted');
      fetchNotices();
    } catch {
      message.error('Delete failed');
    }
  };

  const handleToggle = async (id, isActive) => {
    try {
      await api.put(`/notices/${id}`, { isActive });
      setNotices((prev) => prev.map((n) => n._id === id ? { ...n, isActive } : n));
      setEditing((prev) => prev && prev._id === id ? { ...prev, isActive } : prev);
    } catch {
      message.error('Update failed');
    }
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 180,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      render: (v) => v.length > 60 ? v.slice(0, 60) + '…' : v,
    },
    {
      title: 'Target Roles',
      dataIndex: 'targetRoles',
      key: 'targetRoles',
      render: (roles) => (
        <Space size={4} wrap>
          {roles.map((r) => <Tag key={r} color={ROLE_COLORS[r]}>{r}</Tag>)}
        </Space>
      ),
    },
    {
      title: 'Start',
      dataIndex: 'startDate',
      key: 'startDate',
      render: (v) => dayjs(v).format('DD MMM YYYY'),
      width: 120,
    },
    {
      title: 'End',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (v) => dayjs(v).format('DD MMM YYYY'),
      width: 120,
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (val, record) => (
        <Switch
          checked={val}
          size="small"
          onChange={(checked) => handleToggle(record._id, checked)}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button
            type="text" size="small" icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          />
          <Popconfirm
            title="Delete this notice?"
            onConfirm={() => handleDelete(record._id)}
            okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Notices</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          New Notice
        </Button>
      </div>

      <Table
        dataSource={notices}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 15 }}
      />

      <Modal
        title={editing ? 'Edit Notice' : 'New Notice'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText={editing ? 'Save' : 'Create'}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title required' }]}>
            <Input placeholder="Notice title" />
          </Form.Item>

          <Form.Item name="message" label="Message" rules={[{ required: true, message: 'Message required' }]}>
            <Input.TextArea rows={3} placeholder="Notice message" />
          </Form.Item>

          <Form.Item
            name="targetRoles"
            label="Target Roles"
            rules={[{ required: true, type: 'array', min: 1, message: 'Select at least one role' }]}
          >
            <Select mode="multiple" options={ROLE_OPTIONS} placeholder="Select roles" />
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="Active Date Range"
            rules={[{ required: true, message: 'Date range required' }]}
          >
            <RangePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
