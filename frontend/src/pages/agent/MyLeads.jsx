import { useEffect, useState } from 'react';
import { Table, Tag, Button, Empty } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import api from '../../api/client';

const statusMeta = {
  submitted: { color: '#1a1410', bg: '#ece5d2', label: 'Submitted' },
  assigned_to_bank: { color: '#1a1410', bg: '#dbe4d6', label: 'Assigned' },
  under_review: { color: '#5a3a00', bg: '#f0e2c4', label: 'Under Review' },
  approved: { color: '#0c4a25', bg: '#cce4d4', label: 'Approved' },
  rejected: { color: '#fbf7ee', bg: '#7f1d1d', label: 'Rejected' },
  disbursed: { color: '#fbf7ee', bg: '#1a1410', label: 'Disbursed' },
};

const productLabels = { credit_card: 'Credit Card', loan: 'Loan' };

function StatusPill({ s }) {
  const m = statusMeta[s] || { color: 'var(--ink)', bg: 'var(--paper)', label: s };
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 9px',
      background: m.bg,
      color: m.color,
      fontFamily: 'var(--font-mono)',
      fontSize: 10.5,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
    }}>{m.label}</span>
  );
}

function MyLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/leads/mine').then((res) => setLeads(res.data)).finally(() => setLoading(false));
  }, []);

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
      title: 'Customer',
      dataIndex: 'customerName',
      render: (v) => (
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink)' }}>{v}</span>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      render: (v) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{v}</span>,
    },
    {
      title: 'Product',
      dataIndex: 'productType',
      render: (v) => <span style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)' }}>{productLabels[v]}</span>,
    },
    { title: 'Bank', dataIndex: ['bank', 'name'] },
    { title: 'Status', dataIndex: 'status', render: (s) => <StatusPill s={s} /> },
    {
      title: 'Filed',
      dataIndex: 'createdAt',
      render: (d) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-muted)' }}>
          {new Date(d).toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })}
        </span>
      ),
    },
  ];

  return (
    <>
      <div style={styles.head}>
        <div>
          <div className="eyebrow">§ My Filings</div>
          <h1 style={styles.h1}>
            The <em style={styles.italic}>register.</em>
          </h1>
        </div>
        <Link to="/agent/leads/new">
          <Button type="primary" icon={<PlusOutlined />} style={styles.cta}>
            File New Lead
          </Button>
        </Link>
      </div>
      <hr className="rule-double" style={{ margin: '24px 0 32px' }} />

      <Table
        rowKey="_id"
        loading={loading}
        dataSource={leads}
        columns={columns}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        locale={{ emptyText: <Empty description={<span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--ink-muted)' }}>No filings yet — the page is blank.</span>} /> }}
      />
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

export default MyLeads;
