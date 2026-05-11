import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space, Typography, Row, Col, message, Popconfirm, Switch, Divider,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../api/client';

const SYSTEM_STAGES = [
  { value: 'draft',        label: 'Draft',        color: 'default' },
  { value: 'submitted',    label: 'Submitted',    color: 'blue' },
  { value: 'under_review', label: 'Under Review', color: 'gold' },
  { value: 'assigned',     label: 'Assigned',     color: 'cyan' },
  { value: 'approved',     label: 'Approved',     color: 'green' },
  { value: 'rejected',     label: 'Rejected',     color: 'red' },
  { value: 'disbursed',    label: 'Disbursed',    color: 'purple' },
];

const COLOR_OPTIONS = [
  { value: 'default', label: 'Grey' },
  { value: 'blue', label: 'Blue' },
  { value: 'green', label: 'Green' },
  { value: 'gold', label: 'Gold' },
  { value: 'orange', label: 'Orange' },
  { value: 'red', label: 'Red' },
  { value: 'purple', label: 'Purple' },
  { value: 'cyan', label: 'Cyan' },
  { value: 'volcano', label: 'Volcano' },
];

function EmployeeStatuses() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(false);

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
      const { data } = await api.get('/employee-statuses');
      setStatuses(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addStatus = async () => {
    const values = await addForm.validateFields();
    setAddSaving(true);
    try {
      await api.post('/employee-statuses', values);
      message.success('Status added');
      setAddOpen(false);
      addForm.resetFields();
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to add');
    } finally {
      setAddSaving(false);
    }
  };

  const openEdit = (row) => {
    setEditTarget(row);
    editForm.setFieldsValue({ label: row.label, color: row.color, isActive: row.isActive });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    const values = await editForm.validateFields();
    setEditSaving(true);
    try {
      await api.patch(`/employee-statuses/${editTarget._id}`, values);
      message.success('Status updated');
      setEditOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setEditSaving(false);
    }
  };

  const deleteStatus = async (id) => {
    try {
      await api.delete(`/employee-statuses/${id}`);
      message.success('Status deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const toggleActive = async (id, isActive) => {
    try {
      await api.patch(`/employee-statuses/${id}`, { isActive });
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    }
  };

  const columns = [
    {
      title: 'Label',
      dataIndex: 'label',
      render: (v, row) => <Tag color={row.color}>{v}</Tag>,
    },
    {
      title: 'Color',
      dataIndex: 'color',
      render: (v) => COLOR_OPTIONS.find((c) => c.value === v)?.label || v,
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      render: (v, row) => (
        <Switch checked={v} size="small" onChange={(checked) => toggleActive(row._id, checked)} />
      ),
    },
    {
      title: 'Actions',
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          <Popconfirm
            title="Delete this status?"
            description="Leads using this status will be cleared."
            onConfirm={() => deleteStatus(row._id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Typography.Title level={3} style={{ margin: 0 }}>Lead Status</Typography.Title>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { addForm.resetFields(); setAddOpen(true); }}>
            Add Status
          </Button>
        </Col>
      </Row>

      {/* System stages */}
      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>System Stages</Typography.Text>
      <Space wrap style={{ marginBottom: 4 }}>
        {SYSTEM_STAGES.map((s) => (
          <Tag key={s.value} color={s.color} style={{ fontSize: 13, padding: '2px 10px' }}>{s.label}</Tag>
        ))}
      </Space>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
        Built-in workflow stages — not editable.
      </Typography.Text>

      <Divider style={{ margin: '8px 0 16px' }} />

      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>Custom Labels</Typography.Text>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
        Employees apply these labels to their assigned leads.
      </Typography.Text>

      <Table size="small" rowKey="_id" loading={loading} dataSource={statuses} columns={columns} />

      {/* Add modal */}
      <Modal title="Add Status" open={addOpen} onCancel={() => setAddOpen(false)} onOk={addStatus} okText="Add" confirmLoading={addSaving} destroyOnClose>
        <Form form={addForm} layout="vertical" initialValues={{ color: 'default' }}>
          <Form.Item name="label" label="Label" rules={[{ required: true, message: 'Label is required' }]}>
            <Input placeholder="e.g. Documents Received" />
          </Form.Item>
          <Form.Item name="color" label="Color">
            <Select options={COLOR_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit modal */}
      <Modal title="Edit Status" open={editOpen} onCancel={() => setEditOpen(false)} onOk={saveEdit} okText="Save" confirmLoading={editSaving} destroyOnClose>
        <Form form={editForm} layout="vertical">
          <Form.Item name="label" label="Label" rules={[{ required: true, message: 'Label is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="color" label="Color">
            <Select options={COLOR_OPTIONS} />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default EmployeeStatuses;
