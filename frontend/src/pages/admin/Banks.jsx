import { useEffect, useState } from 'react';
import { Button, Table, Modal, Form, Input, Space, Popconfirm, Typography, message, Switch, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../../api/client';

function AdminBanks() {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [search, setSearch] = useState('');
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/banks');
      setBanks(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ isActive: true }); setOpen(true); };
  const openEdit = (bank) => { setEditing(bank); form.setFieldsValue(bank); setOpen(true); };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/banks/${editing._id}`, values);
        message.success('Bank updated');
      } else {
        await api.post('/banks', values);
        message.success('Bank created');
      }
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/banks/${id}`);
      message.success('Bank deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const toggleActive = async (bank) => {
    setToggling(bank._id);
    try {
      await api.put(`/banks/${bank._id}`, { isActive: !bank.isActive });
      message.success(`Bank marked ${!bank.isActive ? 'active' : 'inactive'}`);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Toggle failed');
    } finally {
      setToggling(null);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (v, row) => (
        <span style={{ fontWeight: 600, color: row.isActive === false ? '#94a3b8' : undefined }}>{v}</span>
      ),
    },
    { title: 'Code', dataIndex: 'code', render: (v) => v || <Typography.Text type="secondary">—</Typography.Text> },
    { title: 'Description', dataIndex: 'description', render: (v) => v || <Typography.Text type="secondary">—</Typography.Text> },
    {
      title: 'Status',
      width: 120,
      render: (_, row) => (
        <Tag color={row.isActive !== false ? 'green' : 'default'}>
          {row.isActive !== false ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      width: 260,
      render: (_, row) => (
        <Space>
          <Switch
            size="small"
            checked={row.isActive !== false}
            loading={toggling === row._id}
            onChange={() => toggleActive(row)}
            checkedChildren="Active"
            unCheckedChildren="Inactive"
          />
          <Button icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          <Popconfirm title="Delete this bank?" onConfirm={() => onDelete(row._id)}>
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Banks</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Bank</Button>
        </div>
      </div>

      <Input
        allowClear
        placeholder="Search banks..."
        prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: 280, marginBottom: 16 }}
      />

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <Table
          size="small"
          rowKey="_id"
          loading={loading}
          dataSource={banks.filter((b) => {
            const q = search.trim().toLowerCase();
            return !q || b.name.toLowerCase().includes(q) || (b.code || '').toLowerCase().includes(q);
          })}
          columns={columns}
        />
      </div>

      <Modal
        title={editing ? 'Edit Bank' : 'Add Bank'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText="Save"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Bank name is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="Code">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="isActive" label="Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default AdminBanks;
