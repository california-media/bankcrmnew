import { useEffect, useState } from 'react';
import {
  Table, Tag, Typography, Button, Modal, Space, message, Badge, Form, Alert,
} from 'antd';
import { EyeOutlined, DeleteOutlined, MailOutlined, SettingOutlined, RollbackOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import api from '../../api/client';
import { UPLOADS_BASE } from '../../utils/uploads';
import InquiryReplyComposer from './InquiryReplyComposer';
import SmtpSettingsFields from '../../components/SmtpSettingsFields';
import { fileIcon, formatBytes } from '../../utils/attachments';

dayjs.extend(relativeTime);

const { Text } = Typography;

const typeLabel = (v) => ({ support: 'Support', other: 'Other' }[v] || 'General Query');
const typeColor = (v) => ({ support: 'orange', other: 'purple' }[v] || 'blue');

const threadCard = (accent) => ({ border: '1px solid #e2e8f0', borderLeft: `3px solid ${accent}`, borderRadius: 8, padding: '12px 14px', background: '#fff' });

function ReplyAttachments({ attachments }) {
  if (!attachments?.length) return null;
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e2e8f0' }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
        <PaperClipOutlined /> {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {attachments.map((a, i) => {
          const chip = (
            <>
              {fileIcon(a.originalName)}
              <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.originalName}</span>
              {a.size ? <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{formatBytes(a.size)}</span> : null}
            </>
          );
          const style = { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', background: '#f8fafc', maxWidth: 260, color: '#0f172a' };
          return a.filename ? (
            <a key={i} href={`${UPLOADS_BASE}/inquiry-reply-files/${a.filename}`} target="_blank" rel="noreferrer" style={style} title={a.originalName}>{chip}</a>
          ) : (
            <span key={i} style={style} title="Sent with the email, but no copy was stored">{chip}</span>
          );
        })}
      </div>
    </div>
  );
}

export default function Inquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const { user } = useSelector((s) => s.auth);
  const isSuperAdmin = user?.role === 'admin' && !user?.adminScope;
  const canReply = user?.role === 'admin' && (!user?.adminScope || user.adminScope === 'coordinator');

  const [composing, setComposing] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [smtpOpen, setSmtpOpen] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpInfo, setSmtpInfo] = useState(null);
  const [smtpForm] = Form.useForm();

  const openSmtp = async () => {
    try {
      const { data } = await api.get('/inquiries/smtp-settings');
      setSmtpInfo(data);
      setSmtpOpen(true);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to load SMTP settings');
    }
  };

  const saveSmtp = async () => {
    const values = await smtpForm.validateFields();
    setSmtpSaving(true);
    try {
      const { data } = await api.put('/inquiries/smtp-settings', values);
      setSmtpInfo(data);
      message.success('SMTP settings saved');
      setSmtpOpen(false);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to save SMTP settings');
    } finally {
      setSmtpSaving(false);
    }
  };

  const onReplySent = (data) => {
    setSelected(data);
    setInquiries((prev) => prev.map((i) => (i._id === data._id ? data : i)));
    setComposing(false);
    setDraftDirty(false);
  };

  const resetComposer = () => { setComposing(false); setDraftDirty(false); };

  // Closing the request with an unsent reply asks first, like a mail client.
  const closeSelected = () => {
    if (composing && draftDirty) {
      Modal.confirm({
        title: 'Discard your unsent reply?',
        okText: 'Discard',
        okButtonProps: { danger: true },
        onOk: () => { resetComposer(); setSelected(null); },
      });
      return;
    }
    resetComposer();
    setSelected(null);
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/inquiries');
      setInquiries(data);
    } catch {
      message.error('Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const open = async (record) => {
    resetComposer();
    setSelected(record);
    if (!record.read) {
      try {
        await api.patch(`/inquiries/${record._id}/read`);
        setInquiries((prev) =>
          prev.map((i) => (i._id === record._id ? { ...i, read: true } : i))
        );
      } catch {}
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/inquiries/${id}`);
      message.success('Deleted');
      setInquiries((prev) => prev.filter((i) => i._id !== id));
      if (selected?._id === id) { resetComposer(); setSelected(null); }
    } catch {
      message.error('Failed to delete');
    }
  };

  const unreadCount = inquiries.filter((i) => !i.read).length;

  const columns = [
    {
      title: '',
      dataIndex: 'read',
      width: 8,
      render: (read) =>
        read ? null : <Badge color="#7C3AED" />,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      render: (name, r) => (
        <Space>
          <Text strong={!r.read}>{name}</Text>
          {!r.read && <Tag color="blue" style={{ fontSize: 10 }}>New</Tag>}
          {r.replies?.length > 0 && <Tag color="green" style={{ fontSize: 10 }}>Replied</Tag>}
        </Space>
      ),
    },
    { title: 'Email',   dataIndex: 'email' },
    { title: 'Type',    dataIndex: 'queryType',   render: (v) => <Tag color={typeColor(v)}>{typeLabel(v)}</Tag> },
    { title: 'Phone',   dataIndex: 'phone',       render: (v) => v || '—' },
    { title: 'Company', dataIndex: 'companyName',  render: (v) => v || '—' },
    {
      title: 'Received',
      dataIndex: 'createdAt',
      render: (v) => dayjs(v).fromNow(),
    },
    {
      title: '',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => open(record)} />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() =>
              Modal.confirm({
                title: 'Delete inquiry?',
                onOk: () => remove(record._id),
              })
            }
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Inquiries</h2>
        {isSuperAdmin && <Button icon={<SettingOutlined />} onClick={openSmtp}>SMTP Settings</Button>}
      </div>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
      <Table
        rowKey="_id"
        dataSource={inquiries}
        columns={columns}
        loading={loading}
        rowClassName={(r) => (!r.read ? 'inquiry-unread' : '')}
        pagination={{ pageSize: 20 }}
        onRow={(record) => ({ onClick: () => open(record), style: { cursor: 'pointer' } })}
        scroll={{ x: 'max-content' }}
      />
      </div>

      <Modal
        open={!!selected}
        width={820}
        onCancel={closeSelected}
        maskClosable={false}
        footer={[
          <Button
            key="del"
            danger
            icon={<DeleteOutlined />}
            onClick={() => Modal.confirm({ title: 'Delete inquiry?', okButtonProps: { danger: true }, onOk: () => remove(selected._id) })}
          >
            Delete
          </Button>,
          <Button key="close" onClick={closeSelected}>Close</Button>,
        ]}
        title={
          <Space>
            <MailOutlined />
            {selected?.name}
            {selected && <Tag color={typeColor(selected.queryType)}>{typeLabel(selected.queryType)}</Tag>}
          </Space>
        }
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Original request */}
            <div style={threadCard('#7c3aed')}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <Text strong>{selected.name} <Text type="secondary" style={{ fontWeight: 400 }}>&lt;{selected.email}&gt;</Text></Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(selected.createdAt).format('DD MMM YYYY, HH:mm')}</Text>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                {[selected.phone && `Phone: ${selected.phone}`, selected.companyName && `Company: ${selected.companyName}`].filter(Boolean).join(' · ') || 'Website request'}
              </div>
              <div style={{ marginTop: 10, fontSize: 14, color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                {selected.message || <Text type="secondary">(No message)</Text>}
              </div>
            </div>

            {/* Replies sent */}
            {selected.replies?.map((r) => (
              <div key={r._id} style={threadCard('#16a34a')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <Text strong>
                    {r.sentBy?.name || 'Admin'} <Text type="secondary" style={{ fontWeight: 400 }}>(MySilah)</Text>
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(r.sentAt).format('DD MMM YYYY, HH:mm')}</Text>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {[
                    // replies saved before "To" was editable went to the requester
                    ['To', r.to ?? [selected.email]],
                    ['Cc', r.cc],
                    ['Bcc', r.bcc],
                  ].filter(([, list]) => list?.length).map(([k, list]) => `${k}: ${list.join(', ')}`).join(' · ')}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>{r.subject}</div>
                {r.bodyHtml ? (
                  <div className="inquiry-reply-body" style={{ marginTop: 6, fontSize: 14, color: '#1e293b' }} dangerouslySetInnerHTML={{ __html: r.bodyHtml }} />
                ) : (
                  <div style={{ marginTop: 6, fontSize: 14, color: '#1e293b', whiteSpace: 'pre-wrap' }}>{r.body}</div>
                )}
                <ReplyAttachments attachments={r.attachments} />
              </div>
            ))}

            {canReply && (composing ? (
              <InquiryReplyComposer
                key={selected._id}
                inquiry={selected}
                defaultSubject={selected.queryType === 'other' ? 'Re: Your request — MySilah' : `Re: Your ${typeLabel(selected.queryType)} request — MySilah`}
                onSent={onReplySent}
                onDiscard={resetComposer}
                onDirtyChange={setDraftDirty}
              />
            ) : (
              <div>
                <Button type="primary" icon={<RollbackOutlined />} onClick={() => setComposing(true)}>
                  {selected.replies?.length ? 'Reply again' : 'Reply'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        title="Reply Email — SMTP Settings"
        open={smtpOpen}
        onCancel={() => setSmtpOpen(false)}
        onOk={saveSmtp}
        okText="Save"
        confirmLoading={smtpSaving}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Used only for replying to requests on this page."
        />
        <Form form={smtpForm} layout="vertical" preserve={false} initialValues={{ port: 587, ...smtpInfo, pass: '' }}>
          <SmtpSettingsFields hasPassword={smtpInfo?.hasPassword} />
        </Form>
      </Modal>
    </div>
  );
}
