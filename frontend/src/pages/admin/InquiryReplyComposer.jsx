import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Select, Tooltip, Typography, message, Modal } from 'antd';
import { SendOutlined, PaperClipOutlined, DeleteOutlined, CloseOutlined } from '@ant-design/icons';
import QuillEditor from '../../components/QuillEditor';
import api from '../../api/client';
import { INQUIRY_REPLY_EXTS as ALLOWED_EXTS, formatBytes, fileIcon } from '../../utils/attachments';

const { Text } = Typography;

// Must match the limits in backend upload.middleware + inquiry.controller
const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

const EDITOR_OPTIONS = {
  placeholder: 'Write your reply…',
  modules: {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ color: [] }, { background: [] }],
      [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
      [{ align: [] }],
      ['blockquote', 'link'],
      ['clean'],
    ],
    // Dropped / pasted files become attachments, not inline images
    uploader: { mimetypes: [] },
  },
  formats: ['header', 'bold', 'italic', 'underline', 'strike', 'color', 'background', 'list', 'indent', 'align', 'blockquote', 'link'],
};

const plainText = (html) => {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || '').trim();
};

// Quill 2 writes every list as <ol><li data-list="bullet|ordered">, which email
// clients would all number. Rebuild real <ul>/<ol> runs and drop editor-only markup.
const toEmailHtml = (html) => {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const root = doc.body.firstChild;
  root.querySelectorAll('.ql-ui').forEach((el) => el.remove());
  root.querySelectorAll('ol').forEach((list) => {
    const items = [...list.children];
    if (!items.some((li) => li.dataset.list)) return;
    const frag = doc.createDocumentFragment();
    let current = null;
    let currentType = null;
    items.forEach((li) => {
      const type = li.dataset.list === 'ordered' ? 'ol' : 'ul';
      if (type !== currentType) {
        current = doc.createElement(type);
        frag.appendChild(current);
        currentType = type;
      }
      li.removeAttribute('data-list');
      current.appendChild(li);
    });
    list.replaceWith(frag);
  });
  return root.innerHTML;
};

// Tag input for To/Cc/Bcc: Enter, comma, semicolon, space or leaving the field adds the address.
function RecipientInput({ value, onChange }) {
  const [search, setSearch] = useState('');
  return (
    <Select
      mode="tags"
      variant="borderless"
      value={value}
      searchValue={search}
      onSearch={setSearch}
      onChange={(v) => { onChange(v); setSearch(''); }}
      onBlur={() => { if (search.trim()) { onChange([...value, search]); setSearch(''); } }}
      tokenSeparators={[',', ';', ' ']}
      open={false}
      suffixIcon={null}
      placeholder="Add email and press Enter"
      style={{ flex: 1 }}
    />
  );
}

const toRecipients = (values) => [...new Set((values || []).map((v) => String(v).trim().toLowerCase()).filter(Boolean))];

function InquiryReplyComposer({ inquiry, defaultSubject, onSent, onDiscard, onDirtyChange }) {
  const [subject, setSubject] = useState(defaultSubject);
  const [bodyHtml, setBodyHtml] = useState('');
  const defaultTo = [inquiry.email.toLowerCase()];
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState([]);
  const [bcc, setBcc] = useState([]);
  const [showCc, setShowCc] = useState(false);
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const totalBytes = useMemo(() => files.reduce((n, f) => n + f.size, 0), [files]);
  const toChanged = to.join(',') !== defaultTo.join(',');
  const dirty = !!plainText(bodyHtml) || files.length > 0 || toChanged || cc.length > 0 || bcc.length > 0 || subject !== defaultSubject;

  useEffect(() => { onDirtyChange?.(dirty); }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  const addFiles = (list) => {
    const incoming = [...(list || [])];
    if (!incoming.length) return;
    const next = [...files];
    let total = totalBytes;
    for (const f of incoming) {
      const ext = `.${f.name.toLowerCase().split('.').pop()}`;
      if (!ALLOWED_EXTS.includes(ext)) { message.error(`"${f.name}" — this file type is not allowed`); continue; }
      if (f.size > MAX_FILE_BYTES) { message.error(`"${f.name}" is larger than 10 MB`); continue; }
      if (next.length >= MAX_FILES) { message.error(`You can attach up to ${MAX_FILES} files`); break; }
      if (total + f.size > MAX_TOTAL_BYTES) { message.error('Attachments can be 20 MB in total'); break; }
      if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
      next.push(f);
      total += f.size;
    }
    setFiles(next);
  };

  const onRecipientsChange = (setter) => (values) => {
    const clean = toRecipients(values);
    const bad = clean.filter((e) => !EMAIL_RE.test(e));
    if (bad.length) message.error(`Invalid email: ${bad.join(', ')}`);
    setter(clean.filter((e) => EMAIL_RE.test(e)));
  };

  const send = async () => {
    if (!to.length && !cc.length && !bcc.length) { message.error('Add at least one recipient'); return; }
    if (!subject.trim()) { message.error('Subject is required'); return; }
    if (!plainText(bodyHtml) && !files.length) { message.error('Write a message or attach a file'); return; }
    const fd = new FormData();
    fd.append('subject', subject.trim());
    fd.append('bodyHtml', plainText(bodyHtml) ? toEmailHtml(bodyHtml) : '');
    fd.append('to', JSON.stringify(to));
    fd.append('cc', JSON.stringify(cc));
    fd.append('bcc', JSON.stringify(bcc));
    files.forEach((f) => fd.append('files', f, f.name));
    setSending(true);
    try {
      const { data } = await api.post(`/inquiries/${inquiry._id}/reply`, fd);
      message.success(`Reply sent to ${[...to, ...cc, ...bcc].join(', ')}`);
      onSent(data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const discard = () => {
    if (!dirty) { onDiscard(); return; }
    Modal.confirm({ title: 'Discard this draft?', okText: 'Discard', okButtonProps: { danger: true }, onOk: onDiscard });
  };

  const row = { display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f1f5f9', padding: '4px 12px', minHeight: 40 };
  const label = { width: 52, flexShrink: 0, color: '#64748b', fontSize: 13 };

  return (
    <div
      onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
      onDrop={(e) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } setDragOver(false); }}
      style={{ position: 'relative', border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', boxShadow: '0 4px 16px rgba(15,23,42,0.06)', overflow: 'hidden' }}
    >
      {dragOver && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(124,58,237,0.08)', border: '2px dashed #7c3aed', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6d28d9', fontWeight: 600, pointerEvents: 'none' }}>
          Drop files to attach
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>
        <Text strong style={{ fontSize: 13 }}>Reply</Text>
        <Tooltip title="Close"><Button type="text" size="small" icon={<CloseOutlined />} onClick={discard} /></Tooltip>
      </div>

      <div style={row}>
        <span style={label}>To</span>
        <RecipientInput value={to} onChange={onRecipientsChange(setTo)} />
        {!showCc && <Button type="link" size="small" onClick={() => setShowCc(true)} style={{ padding: 0 }}>Cc / Bcc</Button>}
      </div>
      {showCc && (
        <>
          <div style={row}>
            <span style={label}>Cc</span>
            <RecipientInput value={cc} onChange={onRecipientsChange(setCc)} />
          </div>
          <div style={row}>
            <span style={label}>Bcc</span>
            <RecipientInput value={bcc} onChange={onRecipientsChange(setBcc)} />
          </div>
        </>
      )}
      <div style={row}>
        <span style={label}>Subject</span>
        <Input variant="borderless" value={subject} maxLength={250} onChange={(e) => setSubject(e.target.value)} style={{ flex: 1, paddingLeft: 0 }} />
      </div>

      <div className="inquiry-reply-editor">
        <QuillEditor value={bodyHtml} onChange={setBodyHtml} options={EDITOR_OPTIONS} minHeight={200} />
      </div>
      <div style={{ padding: '6px 12px', fontSize: 12, color: '#94a3b8', borderTop: '1px solid #f1f5f9' }}>
        The email adds {[...to, ...cc, ...bcc].includes(defaultTo[0]) ? `"Dear ${inquiry.name},"` : '"Hello,"'} above your message, your name as the signature, and quotes the original request below.
      </div>

      {files.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '8px 12px', borderTop: '1px solid #f1f5f9' }}>
          {files.map((f, i) => (
            <div key={`${f.name}-${f.size}`} style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 6px 4px 10px', background: '#f8fafc', maxWidth: 260 }}>
              {fileIcon(f.name)}
              <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>{f.name}</span>
              <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{formatBytes(f.size)}</span>
              <Button type="text" size="small" icon={<CloseOutlined style={{ fontSize: 10 }} />} onClick={() => setFiles(files.filter((_, j) => j !== i))} disabled={sending} />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: '1px solid #e2e8f0', background: '#fafafa' }}>
        <Button type="primary" icon={<SendOutlined />} loading={sending} onClick={send}>Send</Button>
        <Tooltip title={`Attach files (PDF, Word, Excel, PowerPoint, images, TXT, ZIP · max 10 MB each, 20 MB total)`}>
          <Button icon={<PaperClipOutlined />} onClick={() => fileInputRef.current?.click()} disabled={sending}>Attach</Button>
        </Tooltip>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_EXTS.join(',')}
          style={{ display: 'none' }}
          onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        />
        {files.length > 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {files.length} file{files.length === 1 ? '' : 's'} · {formatBytes(totalBytes)} of 20 MB
          </Text>
        )}
        <div style={{ flex: 1 }} />
        <Tooltip title="Discard draft"><Button type="text" danger icon={<DeleteOutlined />} onClick={discard} disabled={sending} /></Tooltip>
      </div>

      <style>{`
        .inquiry-reply-editor .ql-toolbar.ql-snow { border: none; border-bottom: 1px solid #f1f5f9; }
        .inquiry-reply-editor .ql-container.ql-snow { border: none; font-size: 14px; }
        .inquiry-reply-editor .ql-editor { max-height: 360px; overflow-y: auto; }
      `}</style>
    </div>
  );
}

export default InquiryReplyComposer;
