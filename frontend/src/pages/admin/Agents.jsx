import { useEffect, useState } from 'react';
import { Table, Typography, Tag } from 'antd';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

function AdminAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/admin/agents').then((res) => setAgents(res.data)).finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v || '—'}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{row.email}</div>
        </div>
      ),
    },
    { title: 'Phone', dataIndex: 'phone', render: (v) => v || '—' },
    {
      title: 'Referral Code',
      dataIndex: 'referralCode',
      render: (v) => <Typography.Text style={{ fontFamily: 'monospace' }}>{v}</Typography.Text>,
    },
    {
      title: 'Referred by',
      dataIndex: 'referredBy',
      render: (v) => v ? <Tag color="blue">{v.name || v.email}</Tag> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    { title: 'Total Leads', dataIndex: ['stats', 'total'] },
    { title: 'Approved', dataIndex: ['stats', 'approved'] },
    {
      title: 'Paid Commission',
      dataIndex: ['stats', 'paidCommission'],
      align: 'right',
      render: (v) => <span style={{ fontWeight: 600 }}>{aed(v)}</span>,
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      render: (d) => new Date(d).toLocaleDateString(),
    },
  ];

  return (
    <>
      <Typography.Title level={3} style={{ margin: 0 }}>Agents</Typography.Title>
      <Typography.Text type="secondary">All registered agents and their lead/commission summary.</Typography.Text>

      <Table rowKey="_id" loading={loading} dataSource={agents} columns={columns} style={{ marginTop: 16 }} />
    </>
  );
}

export default AdminAgents;
