import { useEffect, useState } from 'react';
import { Button, Table, Modal, Form, InputNumber, Switch, Space, Popconfirm, Typography, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

function VolumeBonuses() {
  const [bonuses, setBonuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/volume-bonuses');
      setBonuses(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ active: true }); setOpen(true); };
  const openEdit = (b) => { setEditing(b); form.setFieldsValue(b); setOpen(true); };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/volume-bonuses/${editing._id}`, values);
        message.success('Bonus updated');
      } else {
        await api.post('/volume-bonuses', values);
        message.success('Bonus created');
      }
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/volume-bonuses/${id}`);
      message.success('Bonus deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const columns = [
    { title: 'Threshold', dataIndex: 'threshold', render: (v) => `${v}+ approved leads / month` },
    {
      title: 'Bonus Amount',
      dataIndex: 'amount',
      align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>{aed(v)}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'active',
      render: (v) => v ? <Tag color="green">Active</Tag> : <Tag>Disabled</Tag>,
    },
    {
      title: 'Actions',
      width: 200,
      render: (_, row) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          <Popconfirm title="Delete this bonus?" onConfirm={() => onDelete(row._id)}>
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Volume Bonuses</Typography.Title>
          <Typography.Text type="secondary">
            Reward agents with a flat bonus when they cross monthly approval thresholds. Only the highest threshold met counts.
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Bonus</Button>
      </div>

      <Table rowKey="_id" loading={loading} dataSource={bonuses} columns={columns} />

      <Modal
        title={editing ? 'Edit Bonus' : 'Add Bonus'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText="Save"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="threshold" label="Approved leads threshold (per month)" rules={[{ required: true }]}>
            <InputNumber min={1} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="amount" label="Bonus amount (AED)" rules={[{ required: true }]}>
            <InputNumber min={0} step={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default VolumeBonuses;
