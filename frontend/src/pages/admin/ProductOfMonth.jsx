import { useEffect, useState } from 'react';
import { Button, Select, Input, Space, Alert, Tag, Typography, message, List } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import api from '../../api/client';

const MAX_ITEMS = 6;
const TYPE_OPTIONS = [
  { value: 'credit_card', label: 'Credit card' },
  { value: 'loan', label: 'Loan' },
  { value: 'account', label: 'Account' },
];
const TYPE_LABEL = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));
const ENDPOINT = { credit_card: '/card-products', loan: '/loan-products', account: '/account-products' };
const errMsg = (err, fallback) => err.response?.data?.message || fallback;
const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, marginBottom: 16 };

export default function ProductOfMonth() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [type, setType] = useState('credit_card');
  const [options, setOptions] = useState([]);
  const [pick, setPick] = useState(null);
  const [tagline, setTagline] = useState('');

  useEffect(() => {
    api.get('/admin/product-of-month').then((res) => setItems(res.data.items || []))
      .catch((err) => setError(errMsg(err, 'Failed to load')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.get(ENDPOINT[type]).then((res) => {
      const list = Array.isArray(res.data) ? res.data : res.data.products || res.data.items || [];
      setOptions(list.map((p) => ({ value: p._id, label: `${p.name}${p.bank?.name ? ` (${p.bank.name})` : ''}`, product: p })));
    }).catch((err) => setError(errMsg(err, 'Failed to load products')));
  }, [type]);

  const add = () => {
    setError('');
    if (!pick) return setError('Choose a product');
    if (items.length >= MAX_ITEMS) return setError(`At most ${MAX_ITEMS} products`);
    if (items.some((i) => i.productType === type && i.product._id === pick)) return setError('That product is already in the list');
    const opt = options.find((o) => o.value === pick);
    setItems((prev) => [...prev, {
      productType: type,
      tagline: tagline.trim(),
      product: { _id: pick, name: opt.product.name, bank: opt.product.bank ? { _id: opt.product.bank._id, name: opt.product.bank.name } : null },
    }]);
    setPick(null);
    setTagline('');
  };

  const move = (i, d) => setItems((prev) => {
    const next = [...prev];
    const j = i + d;
    if (j < 0 || j >= next.length) return prev;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const setTag = (i, v) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, tagline: v } : it)));

  const save = async () => {
    setError('');
    if (items.some((i) => i.tagline.length > 80)) return setError('Taglines must be at most 80 characters');
    setSaving(true);
    try {
      const res = await api.put('/admin/product-of-month', {
        items: items.map((i) => ({ productType: i.productType, product: i.product._id, tagline: i.tagline.trim() })),
      });
      setItems(res.data.items || []);
      message.success('Saved');
    } catch (err) {
      const m = errMsg(err, 'Failed to save');
      setError(m);
      message.error(m);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <Typography.Title level={4}>Product of the Month</Typography.Title>
      <Typography.Paragraph type="secondary">Up to {MAX_ITEMS} products shown in the agent app Home carousel, in this order. Inactive or agent-hidden products are skipped in the app.</Typography.Paragraph>
      {error && <Alert type="error" showIcon message={error} closable onClose={() => setError('')} style={{ marginBottom: 16 }} />}
      <div style={cardStyle}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Current picks ({items.length}/{MAX_ITEMS})</div>
        <List
          loading={loading}
          locale={{ emptyText: 'No products picked' }}
          dataSource={items}
          renderItem={(it, i) => (
            <List.Item
              actions={[
                <Button key="up" size="small" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => move(i, -1)} />,
                <Button key="down" size="small" icon={<ArrowDownOutlined />} disabled={i === items.length - 1} onClick={() => move(i, 1)} />,
                <Button key="rm" size="small" danger icon={<DeleteOutlined />} onClick={() => setItems((prev) => prev.filter((_x, idx) => idx !== i))} />,
              ]}
            >
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <span><Tag color="purple">{TYPE_LABEL[it.productType]}</Tag>{it.product.name}{it.product.bank?.name ? ` (${it.product.bank.name})` : ''}</span>
                <Input size="small" maxLength={80} placeholder="Tagline (optional)" value={it.tagline} onChange={(e) => setTag(i, e.target.value)} />
              </Space>
            </List.Item>
          )}
        />
        <Button type="primary" style={{ marginTop: 12 }} loading={saving} onClick={save}>Save</Button>
      </div>
      <div style={cardStyle}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Add a product</div>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select style={{ width: '100%' }} value={type} options={TYPE_OPTIONS} onChange={(v) => { setType(v); setPick(null); setOptions([]); }} />
          <Select
            showSearch
            style={{ width: '100%' }}
            placeholder="Search products"
            value={pick}
            options={options}
            optionFilterProp="label"
            onChange={setPick}
          />
          <Input maxLength={80} placeholder="Tagline (optional, max 80)" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          <Button icon={<PlusOutlined />} disabled={items.length >= MAX_ITEMS} onClick={add}>Add</Button>
        </Space>
      </div>
    </div>
  );
}
