import { useEffect, useState } from 'react';
import { Button, Table, Modal, Form, Input, Select, Space, Popconfirm, Typography, message, Switch, Tag, Upload, Checkbox, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, FilePdfOutlined, PlayCircleOutlined } from '@ant-design/icons';
import api from '../../api/client';

const UPLOADS_BASE = import.meta.env.VITE_UPLOADS_BASE || (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/api$/, '/uploads');

const TYPE_OPTIONS = [
  { value: 'flyer', label: 'Flyer' },
  { value: 'policy', label: 'Policy Document' },
  { value: 'training', label: 'Training Deck' },
  { value: 'other', label: 'Other' },
];
const TYPE_COLORS = { flyer: 'blue', policy: 'gold', training: 'purple', other: 'default' };
const ROLE_OPTIONS = [
  { value: 'agent', label: 'Agent' },
  { value: 'agency', label: 'Partner Agency' },
  { value: 'coordinator', label: 'Agency Coordinator' },
  { value: 'sales', label: 'Sales Staff' },
  { value: 'cpv', label: 'CPV Staff' },
  { value: 'account', label: 'Account Access' },
];
const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((o) => [o.value, o.label]));

function Resources() {
  const [resources, setResources] = useState([]);
  const [banks, setBanks] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [fileList, setFileList] = useState([]);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [resRes, banksRes, agenciesRes] = await Promise.all([
        api.get('/resources'),
        api.get('/banks'),
        api.get('/agencies'),
      ]);
      setResources(resRes.data);
      setBanks(banksRes.data);
      setAgencies(agenciesRes.data);
    } catch {
      message.error('Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const bankOptions = banks.map((b) => ({ value: b._id, label: b.name }));
  const agencyOptions = agencies.map((a) => ({ value: a._id, label: a.name || a.email }));

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    setFileList([]);
    setOpen(true);
  };

  const openEdit = (r) => {
    setEditing(r);
    form.setFieldsValue({
      title: r.title,
      description: r.description || '',
      bank: r.bank?._id || r.bank || undefined,
      type: r.type,
      videoLink: r.videoLink || '',
      assignedAgencies: (r.assignedAgencies || []).map((a) => a?._id || a),
      visibleToRoles: r.visibleToRoles || [],
      isActive: r.isActive !== false,
    });
    setFileList(r.file ? [{
      uid: '-1', name: r.file, status: 'done',
      url: `${UPLOADS_BASE}/resources/${r.file}`,
      thumbUrl: r.fileType === 'image' ? `${UPLOADS_BASE}/resources/${r.file}` : undefined,
    }] : []);
    setOpen(true);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    const newFile = fileList.find((f) => f.originFileObj);
    if (!editing && !newFile && !values.videoLink) {
      message.error('A file or a video link is required');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('title', values.title);
      fd.append('description', values.description || '');
      fd.append('bank', values.bank || '');
      fd.append('type', values.type);
      fd.append('videoLink', values.videoLink || '');
      // Assign to Agencies only shows once a role is picked (same rule for
      // both Add and Edit) — so if no role is checked, it doesn't apply,
      // regardless of what it was set to before.
      const hasRoles = (values.visibleToRoles || []).length > 0;
      fd.append('assignedAgencies', JSON.stringify(hasRoles ? (values.assignedAgencies || []) : []));
      fd.append('visibleToRoles', JSON.stringify(values.visibleToRoles || []));
      fd.append('isActive', values.isActive !== false ? 'true' : 'false');
      if (newFile) fd.append('file', newFile.originFileObj);

      if (editing) {
        await api.put(`/resources/${editing._id}`, fd);
        message.success('Resource updated');
      } else {
        await api.post('/resources', fd);
        message.success('Resource created');
      }
      setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/resources/${id}`);
      message.success('Resource deleted');
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const toggleActive = async (row) => {
    try {
      const fd = new FormData();
      fd.append('isActive', row.isActive !== false ? 'false' : 'true');
      await api.put(`/resources/${row._id}`, fd);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Update failed');
    }
  };

  const columns = [
    {
      title: 'File',
      width: 70,
      render: (_, row) => {
        if (row.fileType === 'image') {
          return <img src={`${UPLOADS_BASE}/resources/${row.file}`} alt="" style={{ width: 52, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }} />;
        }
        if (row.fileType === 'pdf') {
          return <div style={{ width: 52, height: 40, borderRadius: 4, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fef2f2', color: '#dc2626', fontSize: 18 }}><FilePdfOutlined /></div>;
        }
        return <div style={{ width: 52, height: 40, borderRadius: 4, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', color: '#2563eb', fontSize: 18 }}><PlayCircleOutlined /></div>;
      },
    },
    { title: 'Title', dataIndex: 'title', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Bank', render: (_, row) => row.bank?.name || <Typography.Text type="secondary">—</Typography.Text> },
    { title: 'Type', dataIndex: 'type', render: (v) => <Tag color={TYPE_COLORS[v]}>{TYPE_OPTIONS.find((t) => t.value === v)?.label || v}</Tag> },
    {
      title: 'Restricted To',
      render: (_, row) => row.assignedAgencies?.length
        ? <Tag>{row.assignedAgencies.length} agenc{row.assignedAgencies.length === 1 ? 'y' : 'ies'}</Tag>
        : <Typography.Text type="secondary">All agencies</Typography.Text>,
    },
    {
      title: 'Visible To',
      width: 170,
      render: (_, row) => {
        if (!row.visibleToRoles?.length) return <Typography.Text type="secondary">Everyone</Typography.Text>;
        const labels = row.visibleToRoles.map((r) => ROLE_LABEL[r] || r);
        const MAX_SHOWN = 2;
        const shown = labels.slice(0, MAX_SHOWN);
        const rest = labels.slice(MAX_SHOWN);
        return (
          <Space size={4} wrap>
            {shown.map((l) => <Tag key={l}>{l}</Tag>)}
            {rest.length > 0 && (
              <Tooltip title={rest.join(', ')}>
                <Tag>+{rest.length} more</Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      render: (v, row) => <Switch checked={v !== false} checkedChildren="On" unCheckedChildren="Off" onChange={() => toggleActive(row)} />,
    },
    {
      title: 'Actions',
      width: 160,
      render: (_, row) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          <Popconfirm title="Delete this resource?" onConfirm={() => onDelete(row._id)}>
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Resources</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Resource</Button>
      </div>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Flyers, policy documents, and training material (files or videos) available to agents, agencies, and staff to view or download.
      </Typography.Text>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <Table size="small" rowKey="_id" loading={loading} dataSource={resources} columns={columns} scroll={{ x: 'max-content' }} />
      </div>

      <Modal
        title={editing ? 'Edit Resource' : 'Add Resource'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText="Save"
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. FAB Titanium Card Flyer" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional notes" />
          </Form.Item>
          <Form.Item name="bank" label="Bank (optional)">
            <Select allowClear showSearch placeholder="Select bank" options={bankOptions} filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())} />
          </Form.Item>
          <Form.Item name="type" label="Type" rules={[{ required: true, message: 'Select a type' }]}>
            <Select placeholder="Select type" options={TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="On" unCheckedChildren="Off" />
          </Form.Item>
          <Form.Item label="File (image or PDF)" tooltip="Optional if a video link is provided below — a resource just needs one or the other.">
            <Upload
              listType="picture-card"
              fileList={fileList}
              beforeUpload={(file) => {
                setFileList([{ uid: file.uid, name: file.name, status: 'done', originFileObj: file }]);
                return false;
              }}
              onRemove={() => { setFileList([]); return false; }}
              accept=".jpg,.jpeg,.png,.pdf"
              maxCount={1}
            >
              {fileList.length === 0 && (
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8, fontSize: 12 }}>Upload</div>
                </div>
              )}
            </Upload>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>JPG, PNG, or PDF — max 10 MB</Typography.Text>
          </Form.Item>
          <Form.Item name="videoLink" label="Video Link" tooltip="Optional if a file is uploaded above. e.g. a YouTube or Vimeo link for a training video.">
            <Input placeholder="https://youtube.com/watch?v=..." />
          </Form.Item>
          <Form.Item
            name="visibleToRoles"
            label="Visible To"
            tooltip="Leave empty to show this resource to everyone (default). Tick specific roles to restrict it — e.g. a training video just for Sales and CPV staff."
          >
            <Checkbox.Group options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item shouldUpdate={(prev, cur) => prev.visibleToRoles !== cur.visibleToRoles} noStyle>
            {({ getFieldValue }) => {
              // Same rule for Add and Edit: Assign to Agencies only shows
              // (and only applies — see onSubmit) once a role is picked.
              const hasRoles = getFieldValue('visibleToRoles')?.length > 0;
              if (!hasRoles) {
                // Warn before this save silently lifts an agency restriction
                // that was set before Visible To existed (or before it was
                // unchecked just now) — since with no role picked, Assign to
                // Agencies is hidden and won't be sent, per the rule above.
                return editing?.assignedAgencies?.length > 0 && (
                  <Typography.Paragraph type="warning" style={{ marginTop: -12, marginBottom: 16, fontSize: 12.5 }}>
                    This resource is currently restricted to {editing.assignedAgencies.length} agenc{editing.assignedAgencies.length === 1 ? 'y' : 'ies'}. Pick a role above to keep managing that, or saving now will make it visible to every agency.
                  </Typography.Paragraph>
                );
              }
              return (
                <Form.Item
                  name="assignedAgencies"
                  label="Assign to Agencies"
                  tooltip="Leave empty to keep this resource visible to every agency (default). Pick specific agencies to restrict it to only them."
                >
                  <Select
                    mode="multiple"
                    allowClear
                    showSearch
                    placeholder="All agencies (default) — pick to restrict"
                    options={agencyOptions}
                    filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default Resources;
