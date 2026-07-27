import { useEffect, useMemo, useState } from 'react';
import { Table, Typography, DatePicker, Select, Button, Card, Row, Col, Statistic, Grid, Tag, Tabs } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import api from '../../api/client';

const { useBreakpoint } = Grid;

const STATUS_LABELS = {
  submitted: 'Submitted', under_review: 'Under Review', assigned: 'Assigned',
  approved: 'Approved', rejected: 'Rejected', disbursed: 'Disbursed',
};
const STATUS_COLORS = {
  submitted: '#3b82f6', under_review: '#eab308', assigned: '#06b6d4',
  approved: '#22c55e', rejected: '#ef4444', disbursed: '#a855f7',
};
const STATUS_TAG = {
  submitted: 'blue', under_review: 'gold', assigned: 'cyan',
  approved: 'green', rejected: 'red', disbursed: 'purple',
};
const PRODUCT_LABELS = { credit_card: 'Credit Card', loan: 'Loan' };
const PIE_COLORS = ['#7C3AED', '#0EA5E9'];

function AgencyReports() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [activeTab, setActiveTab] = useState('overview');
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [labelStatuses, setLabelStatuses] = useState([]);
  const [dateRange, setDateRange] = useState([null, null]);
  const [filterStage, setFilterStage] = useState(null);
  const [filterProduct, setFilterProduct] = useState(null);
  const [filterBank, setFilterBank] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads/agency');
      setLeads(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get('/employee-statuses?statusType=lead_label')
      .then(r => setLabelStatuses(r.data.filter(s => s.isActive)))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    let r = leads;
    if (dateRange[0] && dateRange[1]) {
      r = r.filter(l => {
        const d = dayjs(l.createdAt);
        return !d.isBefore(dateRange[0].startOf('day')) && !d.isAfter(dateRange[1].endOf('day'));
      });
    }
    if (filterStage) r = r.filter(l => String(l.employeeStatus?._id) === filterStage);
    if (filterProduct) r = r.filter(l => l.productType === filterProduct);
    if (filterBank) r = r.filter(l => String(l.bank?._id) === filterBank);
    return r;
  }, [leads, dateRange, filterStage, filterProduct, filterBank]);

  const kpi = useMemo(() => {
    const total = filtered.length;
    const disbursed = filtered.filter(l => l.status === 'disbursed').length;
    return {
      total,
      submitted: filtered.filter(l => l.status === 'submitted').length,
      approved: filtered.filter(l => l.status === 'approved').length,
      disbursed,
      rejected: filtered.filter(l => l.status === 'rejected').length,
      conversion: total ? ((disbursed / total) * 100).toFixed(1) : '0.0',
    };
  }, [filtered]);

  const byStage = useMemo(() =>
    labelStatuses.map(s => ({
      name: s.label,
      count: filtered.filter(l => String(l.employeeStatus?._id) === String(s._id)).length,
    })),
    [filtered, labelStatuses]
  );

  const byMonth = useMemo(() => {
    const map = {};
    for (let i = 11; i >= 0; i--) map[dayjs().subtract(i, 'month').format('MMM YY')] = 0;
    filtered.forEach(l => {
      const key = dayjs(l.createdAt).format('MMM YY');
      if (key in map) map[key]++;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [filtered]);

  const byProduct = useMemo(() => [
    { name: 'Credit Card', value: filtered.filter(l => l.productType === 'credit_card').length },
    { name: 'Loan', value: filtered.filter(l => l.productType === 'loan').length },
  ], [filtered]);

  const topBanks = useMemo(() => {
    const map = {};
    filtered.forEach(l => { if (l.bank?.name) map[l.bank.name] = (map[l.bank.name] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
  }, [filtered]);

  const bankOptions = useMemo(() =>
    [...new Map(leads.filter(l => l.bank?._id).map(l => [String(l.bank._id), l.bank])).values()]
      .map(b => ({ value: String(b._id), label: b.name })),
    [leads]
  );

  const perfData = useMemo(() => {
    const map = new Map();
    filtered.forEach(l => {
      const key = `${l.bank?._id}|${l.productType}|${l.agent?._id}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          bank: l.bank?.name || '—',
          product: PRODUCT_LABELS[l.productType] || l.productType || '—',
          agent: l.agent?.name || l.agent?.email || '—',
          newLead: 0, approved: 0, rejected: 0, disbursed: 0,
        });
      }
      const row = map.get(key);
      const s = l.status;
      if (['submitted', 'under_review', 'assigned'].includes(s)) row.newLead++;
      else if (s === 'approved') row.approved++;
      else if (s === 'rejected') row.rejected++;
      else if (s === 'disbursed') row.disbursed++;
    });
    return [...map.values()].sort((a, b) => a.bank.localeCompare(b.bank));
  }, [filtered]);

  const exportPerfExcel = () => {
    const from = dateRange[0] ? dateRange[0].format('DD-MM-YYYY') : 'all time';
    const to   = dateRange[1] ? dateRange[1].format('DD-MM-YYYY') : 'all time';
    const cols = ['Bank', 'Product', 'New Lead', 'Approved', 'Rejected', 'Disbursed', 'Agent'];
    const aoa = [
      [`Performance Report from ${from} to ${to}`],
      [],
      cols,
      ...perfData.map(r => [r.bank, r.product, r.newLead, r.approved, r.rejected, r.disbursed, r.agent]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: cols.length - 1 } }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Performance');
    XLSX.writeFile(wb, `performance-report-${from}-to-${to}.xlsx`);
  };

  const exportExcel = () => {
    const rows = filtered.map(l => ({
      'Ref #': l.leadNumber || '',
      'Customer': l.customerName || '',
      'Phone': l.phone || '',
      'Product': PRODUCT_LABELS[l.productType] || l.productType || '',
      'Bank': l.bank?.name || '',
      'Stage': l.employeeStatus?.label || '',
      'Status': STATUS_LABELS[l.status] || l.status || '',
      'Agent': l.agent?.name || l.agent?.email || '',
      'Created': l.createdAt ? dayjs(l.createdAt).format('DD MMM YYYY') : '',
      'Updated': l.updatedAt ? dayjs(l.updatedAt).format('DD MMM YYYY') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads Report');
    XLSX.writeFile(wb, `leads-report-${dayjs().format('YYYY-MM-DD')}.xlsx`);
  };

  const resetFilters = () => {
    setDateRange([null, null]);
    setFilterStage(null);
    setFilterProduct(null);
    setFilterBank(null);
  };

  const columns = [
    {
      title: 'Ref #',
      dataIndex: 'leadNumber',
      render: v => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v || '—'}</span>,
    },
    {
      title: 'Customer',
      dataIndex: 'customerName',
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{row.phone}</div>
        </div>
      ),
    },
    { title: 'Product', dataIndex: 'productType', render: v => PRODUCT_LABELS[v] || v },
    { title: 'Bank', render: (_, r) => r.bank?.name || '—' },
    { title: 'Agent', render: (_, r) => r.agent?.name || r.agent?.email || '—' },
    { title: 'Stage', render: (_, r) => r.employeeStatus?.label || '—' },
    {
      title: 'Status',
      dataIndex: 'status',
      render: v => <Tag color={STATUS_TAG[v]}>{STATUS_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '—',
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    },
  ];

  const kpiConfig = [
    { title: 'Total Leads',   value: kpi.total,       color: '#7C3AED' },
    { title: 'Submitted',     value: kpi.submitted,   color: '#3b82f6' },
    { title: 'Approved',      value: kpi.approved,    color: '#22c55e' },
    { title: 'Disbursed',     value: kpi.disbursed,   color: '#a855f7' },
    { title: 'Rejected',      value: kpi.rejected,    color: '#ef4444' },
    { title: 'Conversion %',  value: `${kpi.conversion}%`, color: '#0ea5e9' },
  ];

  return (
    <>
      <div style={{
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
        marginBottom: 20, gap: 12,
      }}>
        <div>
          <Typography.Title level={4} style={{ margin: '0 0 4px', fontWeight: 500 }}>Reports</Typography.Title>
          <Typography.Text type="secondary">{filtered.length} lead{filtered.length !== 1 ? 's' : ''} in selected range</Typography.Text>
        </div>
        {activeTab === 'performance' && (
          <Button type="primary" icon={<DownloadOutlined />} onClick={exportPerfExcel} disabled={!perfData.length}>Export Excel</Button>
        )}
      </div>

      <Card size="small" style={{ marginBottom: 20, borderRadius: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <DatePicker.RangePicker
            value={dateRange}
            onChange={v => setDateRange(v || [null, null])}
            style={{ flex: isMobile ? '1 1 100%' : undefined }}
          />
          <Select
            allowClear
            placeholder="All Stages"
            options={labelStatuses.map(s => ({ value: String(s._id), label: s.label }))}
            value={filterStage}
            onChange={setFilterStage}
            style={{ minWidth: 160 }}
          />
          <Select
            placeholder="All Products"
            options={Object.entries(PRODUCT_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            value={filterProduct}
            onChange={setFilterProduct}
            allowClear
            style={{ width: 150 }}
          />
          <Select
            showSearch
            placeholder="All Banks"
            options={bankOptions}
            value={filterBank}
            onChange={setFilterBank}
            allowClear
            style={{ width: 160 }}
            filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
          />
          <Button icon={<ReloadOutlined />} onClick={resetFilters}>Reset</Button>
        </div>
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: 0 }}
        items={[
          { key: 'overview', label: 'Overview' },
          { key: 'performance', label: 'Performance Report' },
        ]}
      />

      {activeTab === 'overview' && <>
      <Row gutter={[12, 12]} style={{ marginBottom: 20, marginTop: 16 }}>
        {kpiConfig.map(({ title, value, color }) => (
          <Col key={title} xs={12} sm={8} md={4}>
            <Card size="small" style={{ borderRadius: 12, borderTop: `3px solid ${color}` }}>
              <Statistic
                title={<span style={{ fontSize: 11, color: '#64748b' }}>{title}</span>}
                value={value}
                valueStyle={{ fontSize: 20, fontWeight: 700, color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={12}>
          <Card title="Leads by Stage" size="small" style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byStage} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {byStage.map((_, i) => (
                    <Cell key={i} fill={['#7C3AED', '#0EA5E9', '#22c55e', '#f97316', '#ef4444', '#eab308'][i % 6]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Leads Over Time (12 months)" size="small" style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={byMonth} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#1e40af" strokeWidth={2} dot={{ r: 3 }} name="Leads" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Product Type Split" size="small" style={{ borderRadius: 12 }}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={byProduct}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85}
                  dataKey="value"
                  label={({ name, percent }) => percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                  labelLine={false}
                >
                  {byProduct.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Top Banks" size="small" style={{ borderRadius: 12 }}>
            {topBanks.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={topBanks} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1e40af" radius={[0, 4, 4, 0]} name="Leads" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                No data
              </div>
            )}
          </Card>
        </Col>
      </Row>

      </>}

      {activeTab === 'performance' && <>
        <div style={{ margin: '16px 0 16px', color: '#64748b', fontSize: 13 }}>
          {dateRange[0] && dateRange[1]
            ? `Performance Report: ${dateRange[0].format('DD-MM-YYYY')} to ${dateRange[1].format('DD-MM-YYYY')}`
            : 'Performance Report — all time (select date range to filter)'}
        </div>
        <Card size="small" style={{ borderRadius: 12 }}>
          <Table
            rowKey="key"
            size="small"
            loading={loading}
            dataSource={perfData}
            scroll={{ x: 700 }}
            pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `${t} rows` }}
            summary={rows => {
              const tot = (k) => rows.reduce((s, r) => s + r[k], 0);
              return (
                <Table.Summary.Row style={{ fontWeight: 700, background: '#f8fafc' }}>
                  <Table.Summary.Cell index={0} colSpan={2}>Total</Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>{tot('newLead')}</Table.Summary.Cell>
                  <Table.Summary.Cell index={3}>{tot('approved')}</Table.Summary.Cell>
                  <Table.Summary.Cell index={4}>{tot('rejected')}</Table.Summary.Cell>
                  <Table.Summary.Cell index={5}>{tot('disbursed')}</Table.Summary.Cell>
                  <Table.Summary.Cell index={6} />
                </Table.Summary.Row>
              );
            }}
            columns={[
              { title: 'Bank',    dataIndex: 'bank',    sorter: (a, b) => a.bank.localeCompare(b.bank) },
              { title: 'Product', dataIndex: 'product' },
              { title: 'New Lead',  dataIndex: 'newLead',  align: 'center', sorter: (a, b) => a.newLead - b.newLead,
                render: v => <span style={{ fontWeight: 600, color: '#3b82f6' }}>{v}</span> },
              { title: 'Approved',  dataIndex: 'approved',  align: 'center', sorter: (a, b) => a.approved - b.approved,
                render: v => <span style={{ fontWeight: 600, color: '#22c55e' }}>{v}</span> },
              { title: 'Rejected',  dataIndex: 'rejected',  align: 'center', sorter: (a, b) => a.rejected - b.rejected,
                render: v => <span style={{ fontWeight: 600, color: '#ef4444' }}>{v}</span> },
              { title: 'Disbursed', dataIndex: 'disbursed', align: 'center', sorter: (a, b) => a.disbursed - b.disbursed,
                render: v => <span style={{ fontWeight: 600, color: '#a855f7' }}>{v}</span> },
              { title: 'Agent', dataIndex: 'agent' },
            ]}
          />
        </Card>
      </>}
    </>
  );
}

export default AgencyReports;
