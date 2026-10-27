import { useEffect, useState } from 'react';
import {
  Tabs, Table, Button, Modal, Form, Input, InputNumber, Switch, Select, Tag, Space, Popconfirm,
  Alert, Upload, message, Typography,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api/client';

const MAX = 1000000;
const THEMES = ['shop', 'dine', 'cine', 'trav', 'coff', 'fuel'];
const THEME_OPTIONS = THEMES.map((t) => ({ value: t, label: t }));
const errMsg = (err, fallback) => err.response?.data?.message || fallback;
const fmt = (d) => (d ? dayjs(d).format('DD MMM YYYY, HH:mm') : '');

const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16 };
const isWhole = (v) => v !== null && v !== undefined && v !== '' && Number.isInteger(Number(v));

/* ── Settings ─────────────────────────────────────────────────────────── */
function SettingsTab() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [spinEnabled, setSpinEnabled] = useState(true);
  const [inviteEnabled, setInviteEnabled] = useState(true);
  const [inviteReward, setInviteReward] = useState(0);
  const [segments, setSegments] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState('');

  const apply = (s) => {
    setSpinEnabled(!!s.spinEnabled);
    setInviteEnabled(!!s.inviteEnabled);
    setInviteReward(s.inviteReward);
    setSegments((s.spinSegments || []).map((x) => ({ coins: x.coins, weight: x.weight })));
    setUpdatedAt(s.updatedAt);
  };

  useEffect(() => {
    setLoading(true);
    api.get('/admin/coins/settings').then((res) => apply(res.data))
      .catch((err) => setError(errMsg(err, 'Failed to load settings')))
      .finally(() => setLoading(false));
  }, []);

  const setSeg = (i, patch) => setSegments((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const totalWeight = segments.reduce((sum, s) => sum + (Number(s.weight) > 0 ? Number(s.weight) : 0), 0);
  const pct = (s) => (totalWeight > 0 && Number(s.weight) > 0 ? ((Number(s.weight) / totalWeight) * 100).toFixed(1) : '0.0');

  const save = async () => {
    setError('');
    if (segments.length < 4 || segments.length > 8) return setError('Spin wheel needs 4 to 8 segments');
    for (let i = 0; i < segments.length; i += 1) {
      const { coins, weight } = segments[i];
      if (!isWhole(coins) || Number(coins) < 0) return setError(`Row ${i + 1}: coins must be a whole number of 0 or more`);
      if (Number(coins) > MAX) return setError(`Row ${i + 1}: coins must be at most 1,000,000`);
      if (weight === null || weight === '' || !Number.isFinite(Number(weight)) || Number(weight) < 0.01) return setError(`Row ${i + 1}: weight must be 0.01 or more`);
      if (Number(weight) > MAX) return setError(`Row ${i + 1}: weight must be at most 1,000,000`);
    }
    if (!isWhole(inviteReward) || Number(inviteReward) < 0) return setError('Invite reward must be a whole number of coins');
    if (Number(inviteReward) > MAX) return setError('Invite reward must be at most 1,000,000 coins');
    setSaving(true);
    try {
      const res = await api.put('/admin/coins/settings', {
        spinEnabled,
        spinSegments: segments.map((s) => ({ coins: Number(s.coins), weight: Number(s.weight) })),
        inviteEnabled,
        inviteReward: Number(inviteReward),
      });
      apply(res.data);
      message.success('Settings saved');
    } catch (err) {
      const m = errMsg(err, 'Failed to save settings');
      setError(m);
      message.error(m);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: '#', width: 50, render: (_, __, i) => i + 1 },
    {
      title: 'Coins', render: (_, s, i) => (
        <InputNumber min={0} max={MAX} precision={0} value={s.coins} onChange={(v) => setSeg(i, { coins: v })} />
      ),
    },
    {
      title: 'Weight', render: (_, s, i) => (
        <InputNumber min={0.01} max={MAX} step={1} value={s.weight} onChange={(v) => setSeg(i, { weight: v })} />
      ),
    },
    { title: 'Chance', render: (_, s) => <Tag color="purple">{pct(s)}%</Tag> },
    {
      title: '', width: 100, render: (_, __, i) => (
        <Button size="small" danger icon={<DeleteOutlined />} disabled={segments.length <= 4}
          onClick={() => setSegments((prev) => prev.filter((_x, idx) => idx !== i))}>Remove</Button>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 760 }}>
      {error && <Alert type="error" showIcon message={error} closable onClose={() => setError('')} style={{ marginBottom: 16 }} />}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>Daily spin wheel</div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>4 to 8 segments. Chance is each weight divided by the total.</Typography.Text>
          </div>
          <Switch checked={spinEnabled} onChange={setSpinEnabled} checkedChildren="On" unCheckedChildren="Off" />
        </div>
        <Table size="small" rowKey={(_, i) => i} loading={loading} pagination={false} dataSource={segments} columns={columns} scroll={{ x: 'max-content' }} />
        <Button style={{ marginTop: 12 }} icon={<PlusOutlined />} disabled={segments.length >= 8}
          onClick={() => setSegments((prev) => [...prev, { coins: 0, weight: 1 }])}>Add segment</Button>
      </div>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>Invite reward</div>
          <Switch checked={inviteEnabled} onChange={setInviteEnabled} checkedChildren="On" unCheckedChildren="Off" />
        </div>
        <Space align="center">
          <span>Coins per invite</span>
          <InputNumber min={0} max={MAX} precision={0} value={inviteReward} onChange={setInviteReward} />
        </Space>
      </div>
      <Space>
        <Button type="primary" loading={saving} onClick={save}>Save settings</Button>
        {updatedAt && <Typography.Text type="secondary" style={{ fontSize: 12 }}>Last saved {fmt(updatedAt)}</Typography.Text>}
      </Space>
    </div>
  );
}

/* ── Vouchers ─────────────────────────────────────────────────────────── */
function VouchersTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [form] = Form.useForm();
  const [codesTarget, setCodesTarget] = useState(null);
  const [codesText, setCodesText] = useState('');
  const [codesFile, setCodesFile] = useState(null);
  const [codesSaving, setCodesSaving] = useState(false);
  const [codesResult, setCodesResult] = useState('');

  const load = () => {
    setLoading(true);
    return api.get('/admin/coins/vouchers').then((res) => setRows(res.data))
      .catch((err) => message.error(errMsg(err, 'Failed to load vouchers')))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openForm = (v) => {
    setEditTarget(v || null);
    setLogoFile(null);
    form.resetFields();
    form.setFieldsValue(v ? {
      title: v.title, brand: v.brand, category: v.category, valueLabel: v.valueLabel, coinCost: v.coinCost,
      theme: v.theme, validUntil: v.validUntil ? String(v.validUntil).slice(0, 10) : '', sortOrder: v.sortOrder,
      description: v.description, terms: v.terms, isActive: !!v.isActive,
    } : { theme: 'shop', sortOrder: 0, isActive: true });
    setOpen(true);
  };

  const submit = async () => {
    const v = await form.validateFields();
    const fd = new FormData();
    fd.append('title', v.title || '');
    fd.append('brand', v.brand || '');
    fd.append('category', v.category || '');
    fd.append('valueLabel', v.valueLabel || '');
    fd.append('coinCost', String(v.coinCost));
    fd.append('theme', v.theme);
    fd.append('validUntil', v.validUntil || '');
    fd.append('sortOrder', String(v.sortOrder ?? 0));
    fd.append('description', v.description || '');
    fd.append('terms', v.terms || '');
    fd.append('isActive', v.isActive ? 'true' : 'false');
    if (logoFile) fd.append('logo', logoFile);
    setSaving(true);
    try {
      if (editTarget) await api.put(`/admin/coins/vouchers/${editTarget._id}`, fd);
      else await api.post('/admin/coins/vouchers', fd);
      message.success('Voucher saved');
      setOpen(false);
      load();
    } catch (err) {
      message.error(errMsg(err, 'Failed to save voucher'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (v) => {
    const fd = new FormData();
    fd.append('isActive', v.isActive ? 'false' : 'true');
    try {
      await api.put(`/admin/coins/vouchers/${v._id}`, fd);
      message.success(v.isActive ? 'Voucher deactivated' : 'Voucher activated');
      load();
    } catch (err) {
      message.error(errMsg(err, 'Failed to update voucher'));
    }
  };

  const remove = async (v) => {
    try {
      const res = await api.delete(`/admin/coins/vouchers/${v._id}`);
      message.success(res.data?.message || 'Voucher deleted');
    } catch (err) {
      message.error(errMsg(err, 'Failed to delete voucher'));
    }
    load();
  };

  const openCodes = (v) => { setCodesTarget(v); setCodesText(''); setCodesFile(null); setCodesResult(''); };
  const submitCodes = async () => {
    if (!codesFile && !codesText.trim()) return message.error('Enter codes or choose an .xlsx file');
    let body;
    if (codesFile) { body = new FormData(); body.append('file', codesFile); } else body = { text: codesText };
    setCodesSaving(true);
    try {
      const res = await api.post(`/admin/coins/vouchers/${codesTarget._id}/codes`, body);
      setCodesResult(`Added ${res.data.added}, skipped ${res.data.skipped}`);
      message.success(`Added ${res.data.added}, skipped ${res.data.skipped}`);
      setCodesText(''); setCodesFile(null);
      load();
    } catch (err) {
      message.error(errMsg(err, 'Failed to add codes'));
    } finally {
      setCodesSaving(false);
    }
  };

  const columns = [
    {
      title: 'Logo', dataIndex: 'logoUrl', width: 70,
      render: (u) => (u ? <img src={u} alt="" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6, border: '1px solid #e2e8f0' }} /> : '—'),
    },
    { title: 'Title', dataIndex: 'title', render: (t, r) => <div><div style={{ fontWeight: 600 }}>{t}</div>{r.brand && <div style={{ fontSize: 12, color: '#64748b' }}>{r.brand}</div>}</div> },
    { title: 'Category', dataIndex: 'category', render: (c) => c || '—' },
    { title: 'Coins', dataIndex: 'coinCost' },
    { title: 'Theme', dataIndex: 'theme', render: (t) => <Tag>{t}</Tag> },
    { title: 'Valid until', dataIndex: 'validUntil', render: (d) => (d ? dayjs(d).format('DD MMM YYYY') : 'No expiry') },
    { title: 'Stock', render: (_, r) => `${r.available} / ${r.assigned}`, },
    {
      title: 'Active', dataIndex: 'isActive',
      render: (a, r) => <Switch checked={a} checkedChildren="Active" unCheckedChildren="Inactive" onChange={() => toggleActive(r)} />,
    },
    {
      title: 'Actions', render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openForm(r)}>Edit</Button>
          <Button size="small" icon={<PlusOutlined />} onClick={() => openCodes(r)}>Add codes</Button>
          <Popconfirm title={`Delete "${r.title}" and all its unused codes?`} okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => remove(r)}>
            <Button size="small" danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Stock shows available / assigned codes.</Typography.Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm(null)}>New Voucher</Button>
      </div>
      <div style={{ background: '#fff', borderRadius: 12 }}>
        <Table size="small" rowKey="_id" loading={loading} dataSource={rows} columns={columns} locale={{ emptyText: 'No vouchers yet' }} scroll={{ x: 'max-content' }} />
      </div>

      <Modal title={editTarget ? 'Edit voucher' : 'New voucher'} open={open} onCancel={() => setOpen(false)} onOk={submit}
        okText="Save" confirmLoading={saving} destroyOnClose width={640}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Title is required' }]}><Input /></Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="brand" label="Brand"><Input /></Form.Item>
            <Form.Item name="category" label="Category"><Input /></Form.Item>
            <Form.Item name="valueLabel" label="Value label"><Input placeholder="e.g. AED 50" /></Form.Item>
            <Form.Item name="coinCost" label="Coin cost" rules={[
              { required: true, message: 'Coin cost is required' },
              { type: 'integer', min: 1, message: 'Coin cost must be a whole number of 1 or more' },
            ]}>
              <InputNumber min={1} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="theme" label="Theme"><Select options={THEME_OPTIONS} /></Form.Item>
            <Form.Item name="validUntil" label="Valid until" extra="Leave empty for no expiry">
              <Input type="date" />
            </Form.Item>
            <Form.Item name="sortOrder" label="Sort order"><InputNumber precision={0} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="isActive" label="Active" valuePropName="checked"><Switch /></Form.Item>
          </div>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="terms" label="Terms"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item label="Logo">
            {editTarget?.logoUrl && !logoFile && (
              <img src={editTarget.logoUrl} alt="Current logo" style={{ display: 'block', width: 56, height: 56, objectFit: 'contain', marginBottom: 8, border: '1px solid #e2e8f0', borderRadius: 6 }} />
            )}
            <Upload accept="image/*" maxCount={1} beforeUpload={(f) => { setLogoFile(f); return false; }}
              onRemove={() => setLogoFile(null)} fileList={logoFile ? [{ uid: '1', name: logoFile.name }] : []}>
              <Button icon={<UploadOutlined />}>{editTarget?.logoUrl ? 'Replace logo' : 'Choose logo'}</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={codesTarget ? `Add codes: ${codesTarget.title}` : ''} open={!!codesTarget} onCancel={() => setCodesTarget(null)}
        onOk={submitCodes} okText="Add codes" confirmLoading={codesSaving} destroyOnClose>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 0 }}>
          Paste one code per line, or upload an .xlsx/.csv file (first column; a leading &quot;code&quot; header is skipped). A file takes priority over pasted text. Duplicates and codes over 64 characters are skipped.
        </p>
        <Input.TextArea rows={6} value={codesText} onChange={(e) => setCodesText(e.target.value)} placeholder="CODE-001&#10;CODE-002" />
        <div style={{ marginTop: 12 }}>
          <Upload accept=".xlsx,.xls,.csv" maxCount={1} beforeUpload={(f) => { setCodesFile(f); return false; }}
            onRemove={() => setCodesFile(null)} fileList={codesFile ? [{ uid: '1', name: codesFile.name }] : []}>
            <Button icon={<UploadOutlined />}>Choose spreadsheet</Button>
          </Upload>
        </div>
        {codesResult && <Alert style={{ marginTop: 12 }} type="success" showIcon message={codesResult} />}
      </Modal>
    </>
  );
}

/* ── Redemptions ──────────────────────────────────────────────────────── */
function RedemptionsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [vouchers, setVouchers] = useState([]);
  const [filters, setFilters] = useState({ from: '', to: '', voucher: undefined, agent: '' });

  const fetchPage = async (p, f, append) => {
    setLoading(true);
    try {
      const params = { page: p };
      if (f.from) params.from = f.from;
      if (f.to) params.to = f.to;
      if (f.voucher) params.voucher = f.voucher;
      if (f.agent.trim()) params.agent = f.agent.trim();
      const res = await api.get('/admin/coins/redemptions', { params });
      setItems((prev) => (append ? [...prev, ...res.data.items] : res.data.items));
      setHasMore(!!res.data.hasMore);
      setPage(p);
    } catch (err) {
      message.error(errMsg(err, 'Failed to load redemptions'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(1, filters, false);
    api.get('/admin/coins/vouchers').then((res) => setVouchers(res.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = [
    { title: 'Date', dataIndex: 'createdAt', render: fmt },
    { title: 'Agent', render: (_, r) => (r.user ? <div><div>{r.user.name}</div><div style={{ fontSize: 12, color: '#64748b' }}>{r.user.email}</div></div> : '—') },
    { title: 'Voucher', render: (_, r) => r.voucher?.title || '—' },
    { title: 'Coins', dataIndex: 'coinCost' },
    { title: 'Code', dataIndex: 'code', render: (c) => (c ? <code>{c}</code> : '—') },
    { title: 'Scratched', dataIndex: 'scratchedAt', render: (d) => (d ? fmt(d) : <Tag>No</Tag>) },
  ];

  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        <Input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        <Input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        <Select allowClear placeholder="All vouchers" style={{ minWidth: 180 }} value={filters.voucher}
          onChange={(v) => setFilters({ ...filters, voucher: v })} options={vouchers.map((v) => ({ value: v._id, label: v.title }))} />
        <Input placeholder="Agent name or email" value={filters.agent} onChange={(e) => setFilters({ ...filters, agent: e.target.value })}
          onPressEnter={() => fetchPage(1, filters, false)} />
        <Button type="primary" onClick={() => fetchPage(1, filters, false)}>Filter</Button>
      </Space>
      <div style={{ background: '#fff', borderRadius: 12 }}>
        <Table size="small" rowKey="_id" loading={loading} dataSource={items} columns={columns} pagination={false}
          locale={{ emptyText: 'No redemptions' }} scroll={{ x: 'max-content' }} />
      </div>
      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button loading={loading} onClick={() => fetchPage(page + 1, filters, true)}>Load more</Button>
        </div>
      )}
    </>
  );
}

function CoinsVouchers() {
  return (
    <>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Coins &amp; Vouchers</h2>
      <Tabs
        items={[
          { key: 'settings', label: 'Settings', children: <SettingsTab /> },
          { key: 'vouchers', label: 'Vouchers', children: <VouchersTab /> },
          { key: 'redemptions', label: 'Redemptions', children: <RedemptionsTab /> },
        ]}
      />
    </>
  );
}

export default CoinsVouchers;
