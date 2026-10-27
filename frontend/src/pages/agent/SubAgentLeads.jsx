import { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Input, Select, Row, Col, Typography, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api/client';
import { aed } from '../../utils/dirham';

const STATUS_COLORS = {
  submitted: 'blue', under_review: 'gold', assigned: 'cyan', approved: 'green', rejected: 'red', disbursed: 'purple',
};
const PRODUCT_LABEL = { credit_card: 'Credit Card', loan: 'Loan', account: 'Account' };
const PAY_COLOR = { pending: 'gold', paid: 'green', none: 'default' };
const PAY_LABEL = { pending: 'Pending', paid: 'Paid', none: '—' };

// Leads submitted by this super agent's sub-agents. Customer phone/email and
// the sub-agent's own commission are never sent by the API — only the super
// agent's own commission on each lead.
export default function SubAgentLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    api.get('/super-agent/leads')
      .then((r) => setLeads(r.data))
      .catch(() => message.error('Failed to load sub-agent leads'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (status !== 'all' && l.status !== status) return false;
      if (!q) return true;
      return (l.customerName || '').toLowerCase().includes(q)
        || (l.leadNumber || '').toLowerCase().includes(q)
        || (l.agent?.name || '').toLowerCase().includes(q);
    });
  }, [leads, search, status]);

  const columns = [
    { title: 'Lead ID', dataIndex: 'leadNumber', render: (v) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{v || '—'}</Typography.Text> },
    { title: 'Customer', dataIndex: 'customerName' },
    { title: 'Sub-Agent', render: (_, r) => r.agent?.name || '—' },
    {
      title: 'Product',
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.cardProduct?.name || r.loanProduct?.name || r.accountProduct?.name || PRODUCT_LABEL[r.productType]}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.bank?.name}</div>
        </div>
      ),
    },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={STATUS_COLORS[v]}>{(v || '').replace(/_/g, ' ').toUpperCase()}</Tag> },
    {
      title: 'My Commission',
      align: 'right',
      render: (_, r) => (r.myCommission > 0 ? <span style={{ fontWeight: 600 }}>{aed(r.myCommission)}</span> : <span style={{ color: '#94a3b8' }}>—</span>),
    },
    {
      title: 'Payout',
      render: (_, r) => (r.myCommission > 0 ? <Tag color={PAY_COLOR[r.myCommissionStatus]}>{PAY_LABEL[r.myCommissionStatus]}</Tag> : '—'),
    },
    { title: 'Updated', dataIndex: 'updatedAt', render: (v) => dayjs(v).format('D MMM YYYY') },
  ];

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Sub-Agent Leads</h2>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Input prefix={<SearchOutlined />} placeholder="Search customer, lead ID or sub-agent" allowClear value={search} onChange={(e) => setSearch(e.target.value)} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Select
            style={{ width: '100%' }} value={status} onChange={setStatus}
            options={[{ value: 'all', label: 'All statuses' }, ...Object.keys(STATUS_COLORS).map((s) => ({ value: s, label: s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }))]}
          />
        </Col>
      </Row>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <Table
          size="small" rowKey="_id" loading={loading} dataSource={filtered} columns={columns}
          onRow={(r) => ({ onClick: () => navigate(`/agent/leads/${r._id}`), style: { cursor: 'pointer' } })}
          locale={{ emptyText: 'No leads from your sub-agents yet' }}
          scroll={{ x: 'max-content' }}
        />
      </div>
    </div>
  );
}
