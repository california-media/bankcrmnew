import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Input, Modal, Form, Tag, Upload, message, Spin, Typography, Badge, Grid, Segmented } from 'antd';
import {
  PlusOutlined, PaperClipOutlined, SendOutlined, FilePdfOutlined, FileOutlined,
  CloseCircleOutlined, ArrowLeftOutlined, CheckCircleOutlined, RedoOutlined,
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import api from '../api/client';
import { UPLOADS_BASE, IMAGE_EXT } from '../utils/uploads';

dayjs.extend(relativeTime);
const { useBreakpoint } = Grid;

const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt';
const MAX_MB = 10;

const fileUrl = (a) => `${UPLOADS_BASE}/support-files/${a.filename}`;

function Attachment({ a }) {
  const isImg = IMAGE_EXT.test(a.filename);
  const isPdf = /\.pdf$/i.test(a.filename);
  if (isImg) {
    return (
      <a href={fileUrl(a)} target="_blank" rel="noreferrer">
        <img src={fileUrl(a)} alt={a.originalName} style={{ maxWidth: 220, maxHeight: 160, borderRadius: 8, display: 'block', marginTop: 6 }} />
      </a>
    );
  }
  return (
    <a
      href={fileUrl(a)} target="_blank" rel="noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.06)', color: 'inherit', fontSize: 12 }}
    >
      {isPdf ? <FilePdfOutlined /> : <FileOutlined />}
      <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.originalName || a.filename}</span>
    </a>
  );
}

// File picker that keeps files in state (not uploaded until Send)
function FilePicker({ files, setFiles, disabled }) {
  return (
    <>
      <Upload
        multiple
        accept={ACCEPT}
        showUploadList={false}
        disabled={disabled || files.length >= 5}
        beforeUpload={(file) => {
          if (file.size / 1024 / 1024 > MAX_MB) { message.error(`${file.name} is larger than ${MAX_MB}MB`); return Upload.LIST_IGNORE; }
          setFiles((prev) => (prev.length >= 5 ? prev : [...prev, file]));
          return false;
        }}
      >
        <Button icon={<PaperClipOutlined />} disabled={disabled || files.length >= 5}>Attach</Button>
      </Upload>
      {files.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {files.map((f, i) => (
            <Tag key={`${f.name}-${i}`} closable closeIcon={<CloseCircleOutlined />} onClose={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
              {f.name}
            </Tag>
          ))}
        </div>
      )}
    </>
  );
}

const buildForm = (fields, files) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  files.forEach((f) => fd.append('files', f));
  return fd;
};

export default function Support() {
  const { user } = useSelector((s) => s.auth);
  const isStaff = user.role === 'admin';
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [activeId, setActiveId] = useState(null);
  const [active, setActive] = useState(null);
  const [loadingActive, setLoadingActive] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [newFiles, setNewFiles] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  const [reply, setReply] = useState('');
  const [replyFiles, setReplyFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const loadList = async () => {
    try {
      const { data } = await api.get('/support-tickets');
      setTickets(data);
    } catch {
      message.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const openTicket = async (id, silent) => {
    setActiveId(id);
    if (!silent) setLoadingActive(true);
    try {
      const { data } = await api.get(`/support-tickets/${id}`);
      setActive(data);
      setTickets((prev) => prev.map((t) => (t._id === id ? { ...t, unreadByStaff: false, unreadByOwner: false } : t)));
    } catch {
      message.error('Failed to open ticket');
    } finally {
      setLoadingActive(false);
    }
  };

  useEffect(() => { loadList(); }, []);

  // Light polling keeps the chat fresh without sockets
  useEffect(() => {
    const t = setInterval(() => {
      loadList();
      if (activeId) openTicket(activeId, true);
    }, 15000);
    return () => clearInterval(t);
  }, [activeId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [active?.messages?.length]);

  const createTicket = async () => {
    const v = await form.validateFields();
    setCreating(true);
    try {
      const { data } = await api.post('/support-tickets', buildForm({ subject: v.subject, message: v.message || '' }, newFiles));
      message.success('Ticket raised');
      setNewOpen(false);
      form.resetFields();
      setNewFiles([]);
      await loadList();
      setActive(data);
      setActiveId(data._id);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to raise ticket');
    } finally {
      setCreating(false);
    }
  };

  const sendReply = async () => {
    if (!reply.trim() && !replyFiles.length) return;
    setSending(true);
    try {
      const { data } = await api.post(`/support-tickets/${activeId}/messages`, buildForm({ message: reply }, replyFiles));
      setActive(data);
      setReply('');
      setReplyFiles([]);
      loadList();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status) => {
    try {
      const { data } = await api.patch(`/support-tickets/${activeId}/status`, { status });
      setActive(data);
      loadList();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    }
  };

  const shown = useMemo(
    () => tickets.filter((t) => filter === 'all' || t.status === filter),
    [tickets, filter],
  );

  const isUnread = (t) => (isStaff ? t.unreadByStaff : t.unreadByOwner);
  const closed = active?.status === 'closed';
  const canReply = active && (isStaff || !closed);

  const list = (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: 12, borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!isStaff && (
          <Button type="primary" icon={<PlusOutlined />} block onClick={() => setNewOpen(true)}>Raise a Ticket</Button>
        )}
        <Segmented
          block size="small" value={filter} onChange={setFilter}
          options={[{ label: 'All', value: 'all' }, { label: 'Open', value: 'open' }, { label: 'Closed', value: 'closed' }]}
        />
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading ? <div style={{ padding: 30, textAlign: 'center' }}><Spin /></div> : !shown.length ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No tickets" style={{ padding: 30 }} />
        ) : shown.map((t) => (
          <div
            key={t._id}
            onClick={() => openTicket(t._id)}
            style={{
              padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
              background: t._id === activeId ? '#f5f3ff' : 'transparent',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <span style={{ fontWeight: isUnread(t) ? 700 : 500, fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.subject}
              </span>
              {isUnread(t) && <Badge color="#7C3AED" />}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isStaff && <b>{t.createdBy?.name || t.createdBy?.email} · </b>}{t.lastMessage || 'Attachment'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#94a3b8' }}>
              <span>{t.ticketNumber}</span>
              <span>
                <Tag color={t.status === 'open' ? 'green' : 'default'} style={{ fontSize: 10, margin: 0, marginRight: 6 }}>{t.status}</Tag>
                {dayjs(t.lastMessageAt).fromNow()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const chat = (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {!active ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loadingActive ? <Spin /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={isStaff ? 'Select a ticket to reply' : 'Select a ticket or raise a new one'} />}
        </div>
      ) : (
        <>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
            {isMobile && <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => { setActive(null); setActiveId(null); }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.subject}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {active.ticketNumber}
                {isStaff && ` · ${active.createdBy?.name || ''} (${active.createdBy?.email || ''}) · ${active.createdBy?.isSuperAgent ? 'Super Agent' : active.createdBy?.role}`}
              </div>
            </div>
            <Tag color={closed ? 'default' : 'green'}>{active.status}</Tag>
            {isStaff && (closed
              ? <Button size="small" icon={<RedoOutlined />} onClick={() => setStatus('open')}>Reopen</Button>
              : <Button size="small" icon={<CheckCircleOutlined />} onClick={() => setStatus('closed')}>Close</Button>)}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {active.messages.map((m) => {
              const mine = String(m.sender?._id) === String(user.id);
              return (
                <div key={m._id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                  <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2, textAlign: mine ? 'right' : 'left' }}>
                    {m.isStaff ? `${m.sender?.name || 'MySilah Support'} · Support` : (m.sender?.name || 'User')} · {dayjs(m.createdAt).format('D MMM, h:mm A')}
                  </div>
                  <div style={{
                    padding: '9px 13px', borderRadius: 12, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    background: mine ? '#7C3AED' : '#fff', color: mine ? '#fff' : '#0f172a',
                    border: mine ? 'none' : '1px solid #e2e8f0',
                  }}>
                    {m.text}
                    {(m.attachments || []).map((a) => <Attachment key={a.filename} a={a} />)}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: 12, borderTop: '1px solid #f1f5f9' }}>
            {canReply ? (
              <>
                <Input.TextArea
                  value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Type your message…"
                  onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); sendReply(); } }}
                />
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1 }}><FilePicker files={replyFiles} setFiles={setReplyFiles} disabled={sending} /></div>
                  <Button type="primary" icon={<SendOutlined />} loading={sending} onClick={sendReply}>Send</Button>
                </div>
              </>
            ) : (
              <Typography.Text type="secondary">This ticket is closed. Raise a new ticket if you need more help.</Typography.Text>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>{isStaff ? 'Support Tickets' : 'Support'}</h2>
      </div>
      <div style={{ height: 'calc(100vh - 190px)', minHeight: 420, display: 'flex', gap: 16 }}>
        {(!isMobile || !active) && <div style={{ width: isMobile ? '100%' : 340, flexShrink: 0 }}>{list}</div>}
        {(!isMobile || active) && <div style={{ flex: 1, minWidth: 0 }}>{chat}</div>}
      </div>

      <Modal
        title="Raise a Support Ticket" open={newOpen} onCancel={() => setNewOpen(false)}
        onOk={createTicket} okText="Submit" confirmLoading={creating} destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="subject" label="Subject" rules={[{ required: true, message: 'Subject is required' }]}>
            <Input maxLength={120} placeholder="Briefly describe the issue" />
          </Form.Item>
          <Form.Item name="message" label="Message" rules={[{ required: true, message: 'Please describe your issue' }]}>
            <Input.TextArea rows={4} placeholder="Tell us what happened" />
          </Form.Item>
          <FilePicker files={newFiles} setFiles={setNewFiles} disabled={creating} />
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>Photos, PDFs or documents · up to 5 files · {MAX_MB}MB each</div>
        </Form>
      </Modal>
    </div>
  );
}
