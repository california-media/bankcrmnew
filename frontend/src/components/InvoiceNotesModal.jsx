import { useEffect, useState } from 'react';
import { Modal, Input, Button, Tag, Typography, Empty, message } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import api from '../api/client';

// Conversation between the billed agency (owner login) and admin about one
// invoice. Shared by the admin and agency Invoices pages; `canWrite` is false
// for read-only viewers (e.g. the agency's Account Access staff).
function InvoiceNotesModal({ invoice, open, onClose, canWrite, onUpdated }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const comments = invoice?.comments || [];

  useEffect(() => { if (open) setText(''); }, [open]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post(`/invoices/${invoice._id}/comments`, { text });
      onUpdated?.(invoice._id, data.comments);
      setText('');
    } catch (err) {
      message.error(err.response?.data?.message || 'Could not save note');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal title={`Notes — ${invoice?.invoiceNumber || ''}`} open={open} onCancel={onClose} footer={null} destroyOnClose width={520}>
      <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: canWrite ? 12 : 0 }}>
        {comments.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No notes yet" />
        ) : comments.map((c) => (
          <div key={c._id || c.createdAt} style={{ padding: '8px 10px', marginBottom: 8, borderRadius: 8, background: c.authorRole === 'admin' ? '#f5f3ff' : '#f8fafc', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Typography.Text strong style={{ fontSize: 12 }}>{c.authorName}</Typography.Text>
              <Tag color={c.authorRole === 'admin' ? 'purple' : 'blue'} style={{ margin: 0, fontSize: 10 }}>{c.authorRole === 'admin' ? 'Admin' : 'Agency'}</Tag>
              <Typography.Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>{new Date(c.createdAt).toLocaleString()}</Typography.Text>
            </div>
            <div style={{ fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.text}</div>
          </div>
        ))}
      </div>
      {canWrite && (
        <>
          <Input.TextArea rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a note about this invoice..." />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button type="primary" icon={<SendOutlined />} loading={sending} disabled={!text.trim()} onClick={send}>Add Note</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default InvoiceNotesModal;
