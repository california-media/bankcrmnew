import { useEffect, useMemo, useState } from 'react';
import { Table, Card, Row, Col, Statistic, Input, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

// Money the agency still owes admin for disbursed leads (hasn't confirmed
// full payment yet) — mirrors the same fields agencyPayout.controller.js
// uses for the agency's own "Payouts to Admin" queue.
const isReceivableFromAgency = (l) =>
  l.status === 'disbursed' && ['pending', 'agency_paid'].includes(l.agencyPaymentStatus);

// Money admin still owes agents — commission approved but not yet paid out.
const isPayableToAgent = (l) => ['pending', 'payable'].includes(l.commissionStatus);

function AgencyLedger() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/leads').then((res) => setLeads(res.data)).finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const map = {};
    leads.forEach((l) => {
      const agency = l.agency;
      if (!agency?._id) return;
      const key = agency._id;
      if (!map[key]) map[key] = { key, name: agency.name || agency.email, receivable: 0, payable: 0 };
      if (isReceivableFromAgency(l)) map[key].receivable += l.grossCommission || 0;
      if (isPayableToAgent(l)) map[key].payable += l.commission || 0;
    });
    return Object.values(map)
      .map((r) => ({ ...r, net: r.receivable - r.payable }))
      .filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => b.receivable - a.receivable);
  }, [leads, search]);

  const totals = useMemo(() => ({
    receivable: rows.reduce((s, r) => s + r.receivable, 0),
    payable: rows.reduce((s, r) => s + r.payable, 0),
  }), [rows]);

  const columns = [
    { title: 'Agency', dataIndex: 'name', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    {
      title: 'Receivable (owed to us)', dataIndex: 'receivable', align: 'right',
      render: (v) => <span style={{ color: '#d97706', fontWeight: 700 }}>{aed(v)}</span>,
      sorter: (a, b) => a.receivable - b.receivable,
    },
    {
      title: 'Payable (owed to agents)', dataIndex: 'payable', align: 'right',
      render: (v) => <span style={{ color: '#dc2626', fontWeight: 700 }}>{aed(v)}</span>,
      sorter: (a, b) => a.payable - b.payable,
    },
    {
      title: 'Net Position', dataIndex: 'net', align: 'right',
      render: (v) => <span style={{ color: v >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{aed(v)}</span>,
      sorter: (a, b) => a.net - b.net,
    },
  ];

  return (
    <>
      <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Agency Receivable / Payable</h2>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Per agency: what they still owe us for disbursed leads (Receivable), and what we still owe their agents (Payable).
      </Typography.Text>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Total Receivable" value={totals.receivable} formatter={(v) => aed(v)} valueStyle={{ color: '#d97706', fontWeight: 700 }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Total Payable" value={totals.payable} formatter={(v) => aed(v)} valueStyle={{ color: '#dc2626', fontWeight: 700 }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 12 }}>
            <Statistic title="Net" value={totals.receivable - totals.payable} formatter={(v) => aed(v)} valueStyle={{ color: (totals.receivable - totals.payable) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }} />
          </Card>
        </Col>
      </Row>

      <Input
        allowClear
        placeholder="Search agency..."
        prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: 260, marginBottom: 12 }}
      />

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <Table size="small" rowKey="key" loading={loading} dataSource={rows} columns={columns} locale={{ emptyText: 'No agency balances' }} />
      </div>
    </>
  );
}

export default AgencyLedger;
