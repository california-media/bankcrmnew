import { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Tag, Space, Typography, Row, Col,
  message, Popconfirm, Switch, InputNumber, Tabs,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, StarFilled, StarOutlined, LockOutlined } from '@ant-design/icons';
import api from '../../api/client';

const COLOR_OPTIONS = [
  { value: 'default', label: 'Grey' },
  { value: 'blue',    label: 'Blue' },
  { value: 'green',   label: 'Green' },
  { value: 'gold',    label: 'Gold' },
  { value: 'orange',  label: 'Orange' },
  { value: 'red',     label: 'Red' },
  { value: 'purple',  label: 'Purple' },
  { value: 'cyan',    label: 'Cyan' },
  { value: 'volcano', label: 'Volcano' },
];

function StatusTable({ statusType }) {
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
      const { data } = await api.get(`/employee-statuses?statusType=${statusType}`);
      setStatuses(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusType]);

  const addStatus = async () => {
    const values = await addForm.validateFields();
    setAddSaving(true);
    try {
      await api.post('/employee-statuses', { ...values, statusType });
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
    editForm.setFieldsValue({ label: row.label, color: row.color, isActive: row.isActive, isFixed: row.isFixed });
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

  const updateOrder = async (id, order) => {
    try {
      const { data } = await api.patch(`/employee-statuses/${id}`, { order });
      setStatuses((prev) =>
        [...prev.map((s) => (s._id === id ? { ...s, order: data.order } : s))].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0) || new Date(a.createdAt) - new Date(b.createdAt)
        )
      );
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update order');
    }
  };

  const setDefault = async (id) => {
    try {
      await api.patch(`/employee-statuses/${id}`, { isDefault: true });
      message.success('Default consent status set');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    }
  };

  const columns = [
    {
      title: '#',
      dataIndex: 'order',
      width: 80,
      render: (v, row) => (
        <InputNumber
          size="small"
          min={1}
          defaultValue={v || 0}
          style={{ width: 64 }}
          onBlur={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val !== v) updateOrder(row._id, val);
          }}
          onPressEnter={(e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val !== v) updateOrder(row._id, val);
            e.target.blur();
          }}
        />
      ),
    },
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
    ...(statusType === 'whatsapp_consent' ? [{
      title: 'Default',
      dataIndex: 'isDefault',
      render: (v, row) => v
        ? <StarFilled style={{ color: '#f59e0b', fontSize: 16 }} title="Default consent status" />
        : <StarOutlined style={{ color: '#cbd5e1', fontSize: 16, cursor: 'pointer' }} title="Set as default" onClick={() => setDefault(row._id)} />,
    }] : []),
    {
      title: 'Fixed',
      dataIndex: 'isFixed',
      width: 60,
      render: (v, row) => v
        ? <LockOutlined style={{ color: '#f59e0b', fontSize: 16 }} title="Fixed — cannot be deleted" />
        : null,
    },
    {
      title: 'Actions',
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          {!row.isFixed && (
            <Popconfirm
              title="Delete this status?"
              description="Leads using this status will be cleared."
              onConfirm={() => deleteStatus(row._id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const label = statusType === 'whatsapp_consent' ? 'WhatsApp Consent Status' : 'Custom Lead Labels';
  const desc  = statusType === 'whatsapp_consent'
    ? 'These statuses are shown in the Consent column of the leads table.'
    : 'Employees and agencies apply these labels to their assigned leads.';

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Typography.Text strong style={{ fontSize: 14 }}>{label}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{desc}</Typography.Text>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { addForm.resetFields(); setAddOpen(true); }}>
            Add Status
          </Button>
        </Col>
      </Row>

      <Table size="small" rowKey="_id" loading={loading} dataSource={statuses} columns={columns} />

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

      <Modal title="Edit Status" open={editOpen} onCancel={() => setEditOpen(false)} onOk={saveEdit} okText="Save" confirmLoading={editSaving} destroyOnClose>
        <Form form={editForm} layout="vertical">
          <Form.Item name="label" label="Label" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="color" label="Color">
            <Select options={COLOR_OPTIONS} />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="isFixed" label="Fixed (cannot be deleted)" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function EmployeeStatuses() {
  return (
    <>
      <Typography.Title level={4} style={{ margin: '0 0 12px', fontWeight: 500 }}>Lead Status</Typography.Title>

      <Tabs
        defaultActiveKey="lead_label"
        items={[
          {
            key: 'lead_label',
            label: 'Lead Labels',
            children: <StatusTable statusType="lead_label" />,
          },
          {
            key: 'whatsapp_consent',
            label: 'WhatsApp Consent',
            children: <StatusTable statusType="whatsapp_consent" />,
          },
        ]}
      />
    </>
  );
}

export default EmployeeStatuses;
