import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import api from '../../api/client';

const statusColors = {
  submitted: 'blue',
  assigned_to_bank: 'cyan',
  under_review: 'gold',
  approved: 'green',
  rejected: 'red',
  disbursed: 'purple',
};

const productLabels = { credit_card: 'Credit Card', loan: 'Loan' };

function MyLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/leads/mine').then((res) => setLeads(res.data)).finally(() => setLoading(false));
  }, []);

  const columns = [
    { title: 'Customer', dataIndex: 'customerName' },
    { title: 'Phone', dataIndex: 'phone' },
    { title: 'Product', dataIndex: 'productType', render: (v) => productLabels[v] },
    { title: 'Bank', dataIndex: ['bank', 'name'] },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s) => <Tag color={statusColors[s]}>{s.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Submitted',
      dataIndex: 'createdAt',
      render: (d) => new Date(d).toLocaleDateString(),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>My Leads</Typography.Title>
        <Link to="/agent/leads/new">
          <Button type="primary" icon={<PlusOutlined />}>New Lead</Button>
        </Link>
      </div>
      <Table rowKey="_id" loading={loading} dataSource={leads} columns={columns} />
    </>
  );
}

export default MyLeads;
