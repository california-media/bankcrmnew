import { useEffect, useState } from 'react';
import { Button, Table, Modal, Form, Input, Select, Tag, Space, Typography, message, Alert, Tooltip } from 'antd';
import { PlusOutlined, MailOutlined, CopyOutlined } from '@ant-design/icons';
import api from '../../api/client';

function Agencies() {
  const [agencies, setAgencies] = useState([]);
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([api.get('/agencies'), api.get('/banks')]);
      setAgencies(a.data);
      setBanks(b.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { form.resetFields(); setInviteUrl(null); setOpen(true); };

  const onSubmit = async () => {
    const values = await form.validateFields();
    try {
      const { data } = await api.post('/agencies', values);
      message.success('Invitation issued');
      if (data.inviteUrl) setInviteUrl(data.inviteUrl);
      else setOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to invite');
    }
  };

  const onResend = async (id) => {
    try {
      const { data } = await api.post(`/agencies/${id}/resend-invite`);
      message.success('Invite reissued');
      if (data.inviteUrl) {
        Modal.info({
          title: <span className="eyebrow">§ Reissued Invitation Link</span>,
          content: <Typography.Text copyable>{data.inviteUrl}</Typography.Text>,
        });
      }
    } catch (err) { message.error(err.response?.data?.message || 'Failed'); }
  };

  const StatusPill = ({ active }) => (
    <span style={{
      display: 'inline-block',
      padding: '3px 9px',
      background: active ? '#cce4d4' : '#f0e2c4',
      color: active ? '#0c4a25' : '#5a3a00',
      fontFamily: 'var(--font-mono)',
      fontSize: 10.5,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    }}>{active ? 'Active' : 'Pending Seal'}</span>
  );

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
      title: 'Agency',
      dataIndex: 'name',
      render: (v) => v
        ? <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink)' }}>{v}</span>
        : <span style={{ fontStyle: 'italic', color: 'var(--ink-muted)' }}>&mdash; not yet titled &mdash;</span>,
    },
    { title: 'Email', dataIndex: 'email', render: (v) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{v}</span> },
    {
      title: 'Banks Assigned',
      dataIndex: 'banks',
      render: (banks) =>
        (banks || []).length === 0
          ? <span style={{ color: 'var(--ink-muted)' }}>&mdash;</span>
          : (banks || []).map((b) => <Tag key={b._id}>{b.name}</Tag>),
    },
    { title: 'Status', dataIndex: 'isActive', render: (v) => <StatusPill active={v} /> },
    {
      title: 'Actions',
      width: 160,
      render: (_, row) =>
        !row.isActive && (
          <Tooltip title="Reissue the invitation">
            <Button icon={<MailOutlined />} onClick={() => onResend(row._id)}>Resend</Button>
          </Tooltip>
        ),
    },
  ];

  return (
    <>
      <div style={styles.head}>
        <div>
          <div className="eyebrow">§ Standing Committees</div>
          <h1 style={styles.h1}>The <em style={styles.italic}>agencies.</em></h1>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={styles.cta}>
          Invite agency
        </Button>
      </div>
      <hr className="rule-double" style={{ margin: '24px 0 32px' }} />

      <Table rowKey="_id" loading={loading} dataSource={agencies} columns={columns} pagination={false} />

      <Modal
        title={<span className="eyebrow">§ {inviteUrl ? 'Invitation Issued' : 'Invite a New Agency'}</span>}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={inviteUrl ? () => setOpen(false) : onSubmit}
        okText={inviteUrl ? 'Done' : 'Send the invitation'}
        destroyOnClose
        width={560}
      >
        <hr className="rule" style={{ margin: '8px 0 20px' }} />
        {inviteUrl ? (
          <>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink-soft)', margin: '0 0 16px', lineHeight: 1.5 }}>
              SMTP isn't configured in this edition. Pass this link to the agency by hand &mdash; it expires in 24 hours.
            </p>
            <Alert
              type="info"
              showIcon={false}
              style={{ borderRadius: 0, background: 'var(--paper)', borderColor: 'var(--ink)' }}
              message={
                <Typography.Paragraph copyable={{ icon: <CopyOutlined /> }} style={{ wordBreak: 'break-all', fontFamily: 'var(--font-mono)', fontSize: 12, margin: 0 }}>
                  {inviteUrl}
                </Typography.Paragraph>
              }
            />
          </>
        ) : (
          <Form form={form} layout="vertical" requiredMark={false}>
            <Form.Item name="name" label={<span className="eyebrow">Agency Name (optional)</span>}>
              <Input placeholder="They may also set this themselves" />
            </Form.Item>
            <Form.Item name="email" label={<span className="eyebrow">Email Address</span>} rules={[{ required: true, type: 'email' }]}>
              <Input />
            </Form.Item>
            <Form.Item
              name="banks"
              label={<span className="eyebrow">Banks They May Service</span>}
              rules={[{ required: true, message: 'Choose at least one bank' }]}
            >
              <Select
                mode="multiple"
                placeholder="Select banks"
                options={banks.map((b) => ({ label: b.name, value: b._id }))}
              />
            </Form.Item>
          </Form>
        )}
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

export default Agencies;
