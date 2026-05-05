import { useEffect, useState } from 'react';
import { Button, Table, Modal, Form, Input, Space, Popconfirm, Typography, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../api/client';

function AgencyBanks() {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
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

  const openCreate = () => { setEditing(null); form.resetFields(); setOpen(true); };
  const openEdit = (bank) => { setEditing(bank); form.setFieldsValue(bank); setOpen(true); };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/banks/${editing._id}`, values);
        message.success('Bank updated');
      } else {
        await api.post('/banks', values);
        message.success('Bank added');
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

  const columns = [
    { title: 'Name', dataIndex: 'name' },
    { title: 'Code', dataIndex: 'code', render: (v) => v || <Typography.Text type="secondary">—</Typography.Text> },
    { title: 'Description', dataIndex: 'description', render: (v) => v || <Typography.Text type="secondary">—</Typography.Text> },
    {
      title: 'Actions',
      width: 220,
      render: (_, row) => (
        <Space>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>My Banks</Typography.Title>
          <Typography.Text type="secondary">
            The banks your agency services. Agents can only file leads against these.
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Bank</Button>
      </div>

      <Table rowKey="_id" loading={loading} dataSource={banks} columns={columns} />

      <Modal
        title={editing ? 'Edit Bank' : 'Add Bank'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText="Save"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="Code">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default AgencyBanks;
