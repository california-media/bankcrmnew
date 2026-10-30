import { useEffect, useState } from 'react';
import { Table, Button, Input, Space, Popconfirm, Alert, Upload, Typography, message } from 'antd';
import { UploadOutlined, DownloadOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import api from '../../api/client';

const MAX_BULK = 5000;
const errMsg = (err, fallback) => err.response?.data?.message || fallback;
const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16 };

// Split pasted text on commas / new lines.
const namesFromText = (text) => String(text || '').split(/[\n\r,]+/).map((s) => s.trim()).filter(Boolean);

// First column of the first sheet; a leading "company" / "company name" header is skipped.
const namesFromFile = async (file) => {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  const out = [];
  rows.forEach((r, i) => {
    const v = String(Array.isArray(r) ? r[0] ?? '' : '').trim();
    if (!v) return;
    if (i === 0 && ['company', 'company name', 'companies'].includes(v.toLowerCase())) return;
    out.push(v);
  });
  return out;
};

// Sample upload file: the "Company" header the parser skips, then one name per row in the first column.
const downloadSample = () => {
  const sheet = XLSX.utils.aoa_to_sheet([['Company'], ['Emirates NBD'], ['Etisalat by e&'], ['Dubai Holding'], ['Emirates Airline']]);
  sheet['!cols'] = [{ wch: 32 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Companies');
  XLSX.writeFile(wb, 'companies-sample.xlsx');
};

export default function Companies() {
  const [text, setText] = useState('');
  const [fileNames, setFileNames] = useState(null);
  const [fileName, setFileName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  const [reloadKey, setReloadKey] = useState(0);
  const load = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    api.get('/admin/companies', { params: { q: search, page } })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data.items || []);
        setTotal(res.data.total || 0);
      })
      .catch((err) => { if (!cancelled) message.error(errMsg(err, 'Failed to load companies')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search, page, reloadKey]);

  // A chosen file takes priority over pasted text.
  const pending = fileNames || namesFromText(text);

  const onFile = async (file) => {
    setError('');
    try {
      setFileNames(await namesFromFile(file));
      setFileName(file.name);
    } catch {
      setFileNames(null);
      setFileName('');
      setError('Could not read the file');
    }
    return false;
  };

  const add = async () => {
    setError('');
    setResult(null);
    if (!pending.length) return setError('Enter company names or choose a file');
    if (pending.length > MAX_BULK) return setError(`At most ${MAX_BULK.toLocaleString()} companies per upload`);
    setAdding(true);
    try {
      const res = await api.post('/admin/companies/bulk', { names: pending });
      setResult(res.data);
      setText('');
      setFileNames(null);
      setFileName('');
      if (page !== 1) setPage(1); else load();
    } catch (err) {
      setError(errMsg(err, 'Failed to add companies'));
    } finally {
      setAdding(false);
    }
  };

  const saveEdit = async (r) => {
    try {
      await api.put(`/admin/companies/${r._id}`, { name: editName });
      message.success('Renamed');
      setEditId(null);
      load();
    } catch (err) {
      message.error(errMsg(err, 'Failed to rename'));
    }
  };

  const remove = async (r) => {
    try {
      await api.delete(`/admin/companies/${r._id}`);
      message.success('Deleted');
      if (rows.length === 1 && page > 1) setPage(page - 1); else load();
    } catch (err) {
      message.error(errMsg(err, 'Failed to delete'));
    }
  };

  const columns = [
    {
      title: 'Company',
      render: (_, r) => (editId === r._id ? (
        <Space>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} onPressEnter={() => saveEdit(r)} maxLength={120} style={{ width: 280 }} autoFocus />
          <Button type="primary" size="small" onClick={() => saveEdit(r)}>Save</Button>
          <Button size="small" onClick={() => setEditId(null)}>Cancel</Button>
        </Space>
      ) : r.name),
    },
    {
      title: '',
      width: 120,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditId(r._id); setEditName(r.name); }} />
          <Popconfirm title={`Delete "${r.name}"?`} okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => remove(r)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>Companies</Typography.Title>
      <Typography.Paragraph type="secondary">
        Companies agents and clients can pick from when entering a lead's company. They can still type any other name; that is saved on the lead only.
      </Typography.Paragraph>

      <div style={cardStyle}>
        <Typography.Text strong>Add companies</Typography.Text>
        <Input.TextArea
          rows={4}
          value={text}
          onChange={(e) => { setText(e.target.value); setResult(null); }}
          placeholder="Paste company names, separated by commas or new lines"
          style={{ marginTop: 8 }}
          disabled={!!fileNames}
        />
        <Space style={{ marginTop: 8 }} wrap>
          <Upload accept=".xlsx,.xls,.csv" maxCount={1} showUploadList={false} beforeUpload={onFile}>
            <Button icon={<UploadOutlined />}>Upload .xlsx / .csv</Button>
          </Upload>
          <Button icon={<DownloadOutlined />} onClick={downloadSample}>Download sample file</Button>
          {fileNames && (
            <>
              <Typography.Text type="secondary">{fileName}</Typography.Text>
              <Button type="link" size="small" onClick={() => { setFileNames(null); setFileName(''); }}>Remove file</Button>
            </>
          )}
        </Space>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '8px 0' }}>
          Files: first column, a leading &quot;company&quot; header is skipped. A file takes priority over pasted text.
        </Typography.Paragraph>
        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 8 }} />}
        {result && <Alert type="success" showIcon message={`Added ${result.added} · ${result.duplicates} already in the list · ${result.invalid} invalid`} style={{ marginBottom: 8 }} />}
        <Space>
          <Typography.Text>{pending.length.toLocaleString()} {pending.length === 1 ? 'company' : 'companies'} found</Typography.Text>
          <Button type="primary" loading={adding} disabled={!pending.length} onClick={add}>Add</Button>
        </Space>
      </div>

      <div style={cardStyle}>
        <Input.Search
          allowClear
          placeholder="Search companies"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onSearch={(v) => { setPage(1); setSearch(v.trim()); }}
          style={{ maxWidth: 320, marginBottom: 12 }}
        />
        <Table
          rowKey="_id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={rows}
          pagination={{ current: page, pageSize: 50, total, showSizeChanger: false, onChange: setPage, showTotal: (t) => `${t.toLocaleString()} companies` }}
        />
      </div>
    </div>
  );
}
