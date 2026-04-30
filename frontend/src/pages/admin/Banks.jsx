import { useEffect, useState } from 'react';
import { Button, Table, Modal, Form, Input, Space, Popconfirm, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../api/client';

function Banks() {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try { setBanks((await api.get('/banks')).data); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); form.resetFields(); setOpen(true); };
  const openEdit = (bank) => { setEditing(bank); form.setFieldsValue(bank); setOpen(true); };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) { await api.put(`/banks/${editing._id}`, values); message.success('Bank updated'); }
      else { await api.post('/banks', values); message.success('Bank added to the register'); }
      setOpen(false); load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Save failed');
    }
  };

  const onDelete = async (id) => {
    try { await api.delete(`/banks/${id}`); message.success('Bank removed'); load(); }
    catch (err) { message.error(err.response?.data?.message || 'Delete failed'); }
  };

  const columns = [
    {
      title: 'No.',
      width: 64,
      render: (_, __, idx) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-muted)' }}>
          {String(idx + 1).padStart(3, '0')}
        </span>
      ),
    },
    {
      title: 'Institution',
      dataIndex: 'name',
      render: (v) => (
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)' }}>{v}</span>
      ),
    },
    {
      title: 'Code',
      dataIndex: 'code',
      render: (v) => v ? <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>{v}</span> : <span style={{ color: 'var(--ink-muted)' }}>&mdash;</span>,
    },
    { title: 'Description', dataIndex: 'description', render: (v) => v || <span style={{ color: 'var(--ink-muted)' }}>&mdash;</span> },
    {
      title: 'Actions',
      width: 220,
      render: (_, row) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>
          <Popconfirm title="Strike this bank from the register?" onConfirm={() => onDelete(row._id)}>
            <Button danger icon={<DeleteOutlined />}>Remove</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={styles.head}>
        <div>
          <div className="eyebrow">§ Institutions of Record</div>
          <h1 style={styles.h1}>The <em style={styles.italic}>banks.</em></h1>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={styles.cta}>
          Add a bank
        </Button>
      </div>
      <hr className="rule-double" style={{ margin: '24px 0 32px' }} />

      <Table rowKey="_id" loading={loading} dataSource={banks} columns={columns} pagination={false} />

      <Modal
        title={<span className="eyebrow">{editing ? '§ Edit Bank' : '§ Add a New Bank'}</span>}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        okText={editing ? 'Save' : 'Enter into the register'}
        destroyOnClose
        width={520}
      >
        <hr className="rule" style={{ margin: '8px 0 20px' }} />
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="name" label={<span className="eyebrow">Institution Name</span>} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label={<span className="eyebrow">Short Code</span>}>
            <Input style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="description" label={<span className="eyebrow">Description</span>}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

const styles = {
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 },
  h1: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(48px, 6vw, 80px)',
    lineHeight: 0.95,
    letterSpacing: '-0.03em',
    fontWeight: 400,
    margin: '8px 0 0',
  },
  italic: { fontStyle: 'italic', color: 'var(--accent)' },
  cta: {
    height: 44,
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    background: 'var(--ink)',
    borderColor: 'var(--ink)',
  },
};

export default Banks;
