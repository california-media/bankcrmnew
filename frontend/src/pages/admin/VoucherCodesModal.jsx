import { useEffect, useMemo, useState } from 'react';
import { Modal, Table, Tag, Segmented, Input, Typography, message } from 'antd';
import dayjs from 'dayjs';
import api from '../../api/client';

const STATUS = {
  unused: { label: 'Unused', color: 'green' },
  used: { label: 'Used', color: 'blue' },
  reserved: { label: 'Reserved', color: 'orange' },
};
const fmt = (d) => (d ? dayjs(d).format('DD MMM YYYY, HH:mm') : '—');

/**
 * Coins & Vouchers > Vouchers > "View codes": every code of one voucher, unused or used, and for a used
 * code the agent who got it and when. "Reserved" = taken by a redeem that never finished.
 */
export default function VoucherCodesModal({ voucher, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!voucher) return;
    setData(null);
    setFilter('all');
    setSearch('');
    setLoading(true);
    api.get(`/admin/coins/vouchers/${voucher._id}/codes`)
      .then((res) => setData(res.data))
      .catch((err) => message.error(err.response?.data?.message || 'Failed to load codes'))
      .finally(() => setLoading(false));
  }, [voucher]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.codes || []).filter((c) => {
      if (filter !== 'all' && c.status !== filter) return false;
      if (!q) return true;
      return [c.code, c.usedBy?.name, c.usedBy?.email, c.usedBy?.phone].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [data, filter, search]);

  const counts = data?.counts || { unused: 0, used: 0, reserved: 0 };
  const total = counts.unused + counts.used + counts.reserved;
  const options = [
    { value: 'all', label: `All (${total})` },
    { value: 'unused', label: `Unused (${counts.unused})` },
    { value: 'used', label: `Used (${counts.used})` },
    ...(counts.reserved ? [{ value: 'reserved', label: `Reserved (${counts.reserved})` }] : []),
  ];

  const columns = [
    { title: 'Code', dataIndex: 'code', render: (c) => <Typography.Text code copyable>{c}</Typography.Text> },
    { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={STATUS[s]?.color}>{STATUS[s]?.label || s}</Tag> },
    {
      title: 'Used by',
      render: (_, r) => (r.usedBy ? (
        <div>
          <div style={{ fontWeight: 600 }}>{r.usedBy.name || '—'}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{[r.usedBy.email, r.usedBy.phone].filter(Boolean).join(' · ')}</div>
        </div>
      ) : <Typography.Text type="secondary">—</Typography.Text>),
    },
    { title: 'Used on', dataIndex: 'usedAt', render: fmt },
    { title: 'Scratched', dataIndex: 'scratchedAt', render: (d) => (d ? fmt(d) : <Typography.Text type="secondary">Not yet</Typography.Text>) },
    { title: 'Added', dataIndex: 'addedAt', render: fmt },
  ];

  return (
    <Modal title={voucher ? `Codes: ${voucher.title}` : ''} open={!!voucher} onCancel={onClose} footer={null} width={960} destroyOnClose>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 12 }}>
        <Segmented options={options} value={filter} onChange={setFilter} />
        <Input.Search allowClear placeholder="Search code, agent name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
      </div>
      <Table size="small" rowKey="_id" loading={loading} dataSource={rows} columns={columns} pagination={{ pageSize: 20, hideOnSinglePage: true }} locale={{ emptyText: 'No codes' }} scroll={{ x: 'max-content' }} />
    </Modal>
  );
}
