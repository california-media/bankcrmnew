import { useEffect, useMemo, useState } from 'react';
import { Table, Tag, Typography, Input, Select, DatePicker, Row, Col, Space, Button, message, Modal, Descriptions, Timeline, Tabs } from 'antd';
import { SearchOutlined, SendOutlined, HistoryOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import SendToAgencyModal from '../../components/SendToAgencyModal';

const STATUSES = [
  { value: 'draft', label: 'Draft', color: 'default' },
  { value: 'submitted', label: 'Submitted', color: 'blue' },
  { value: 'under_review', label: 'Under Review', color: 'gold' },
  { value: 'assigned', label: 'Assigned', color: 'cyan' },
  { value: 'approved', label: 'Approved', color: 'green' },
  { value: 'rejected', label: 'Rejected', color: 'red' },
  { value: 'disbursed', label: 'Disbursed', color: 'purple' },
];

const PRODUCTS = [
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'loan', label: 'Loan' },
];

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

function AdminLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState();
  const [productFilter, setProductFilter] = useState();
  const [dateRange, setDateRange] = useState(null);

  const [leadsTab, setLeadsTab] = useState('active');

  const [sendOpen, setSendOpen] = useState(false);
  const [sendingLead, setSendingLead] = useState(null);

  // Payout history modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLead, setHistoryLead] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads');
      setLeads(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const activeCount = leads.filter(l => l.status !== 'disbursed').length;
  const archiveCount = leads.filter(l => l.status === 'disbursed').length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const [from, to] = dateRange || [];
    return leads.filter((l) => {
      if (leadsTab === 'archive' && l.status !== 'disbursed') return false;
      if (leadsTab === 'active' && l.status === 'disbursed') return false;
      if (q && !l.customerName.toLowerCase().includes(q) && !String(l._id).toLowerCase().includes(q)) return false;
      if (statusFilter && l.status !== statusFilter) return false;
      if (productFilter && l.productType !== productFilter) return false;
      if (from && dayjs(l.createdAt).isBefore(from.startOf('day'))) return false;
      if (to && dayjs(l.createdAt).isAfter(to.endOf('day'))) return false;
      return true;
    });
  }, [leads, search, statusFilter, productFilter, dateRange, leadsTab]);

  const renderProduct = (row) => {
    if (row.productType === 'credit_card' && row.cardProduct) {
      return (
        <div>
          <div style={{ fontWeight: 600 }}>{row.cardProduct.name}</div>
          <div style={{ fontSize: 12, color: '#888' }}>
            {row.cardProduct.cardType === 'premium' ? 'Premium' : 'Regular'} · {aed(row.cardProduct.commissionAmount)}
          </div>
        </div>
      );
    }
    if (row.productType === 'loan' && row.loanProduct) {
      return (
        <div>
          <div style={{ fontWeight: 600 }}>{row.loanProduct.name}</div>
          <div style={{ fontSize: 12, color: '#888' }}>
            {row.loanProduct.loanCategory === 'mortgage' ? 'Mortgage' : 'Personal'} · {aed(row.loanAmount)} · {row.loanProduct.commissionRate}%
          </div>
        </div>
      );
    }
    return PRODUCTS.find((p) => p.value === row.productType)?.label || row.productType;
  };

  const columns = [
    {
      title: 'Lead ID',
      dataIndex: 'leadNumber',
      render: (leadNumber) => (
        <Typography.Text type="secondary" style={{ fontFamily: 'monospace', width: 130, whiteSpace: 'nowrap' }}>{leadNumber || '—'}</Typography.Text>
      ),
    },
    {
      title: 'Client',
      dataIndex: 'customerName',
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{row.phone}</div>
        </div>
      ),
    },
    { title: 'Agent', render: (_, row) => row.agent?.name || row.agent?.email || '—' },
    { title: 'Agency', render: (_, row) => row.agency?.name || row.agency?.email || <Typography.Text type="secondary">—</Typography.Text> },
    { title: 'Product', render: (_, row) => renderProduct(row) },
    { title: 'Bank', render: (_, row) => row.bank?.name || <Typography.Text type="secondary">—</Typography.Text> },
    {
      title: 'Stage',
      dataIndex: 'status',
      render: (s) => {
        const meta = STATUSES.find((x) => x.value === s);
        return <Tag color={meta?.color}>{meta?.label || s}</Tag>;
      },
    },
    {
      title: 'Emp. Status',
      render: (_, row) => row.employeeStatus
        ? <Tag color={row.employeeStatus.color}>{row.employeeStatus.label}</Tag>
        : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Commission',
      align: 'right',
      render: (_, row) => (
        <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
          {row.grossCommission > 0 && (
            <div style={{ fontSize: 11, color: '#888' }}>Gross: {aed(row.grossCommission)}</div>
          )}
          <span style={{ fontWeight: 600 }}>{aed(row.commission)}</span>
          {row.commissionStatus !== 'none' && (
            <Tag color={
              row.commissionStatus === 'paid' ? 'green' :
              row.commissionStatus === 'payable' ? 'cyan' : 'gold'
            } style={{ marginInlineEnd: 0 }}>
              {row.commissionStatus}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Actions',
      width: 240,
      render: (_, row) => {
        if (row.status === 'draft') {
          return (
            <Button size="small" type="primary" icon={<SendOutlined />} onClick={() => { setSendingLead(row); setSendOpen(true); }}>
              Send to Agency
            </Button>
          );
        }
        if (row.payoutHistory?.length > 0) {
          return (
            <Button size="small" icon={<HistoryOutlined />} onClick={(e) => { e.stopPropagation(); setHistoryLead(row); setHistoryOpen(true); }}>
              Payout History ({row.payoutHistory.length})
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <>
      <Typography.Title level={3} style={{ margin: 0 }}>All Leads</Typography.Title>
      <Typography.Text type="secondary">{leads.length} total leads across the system.</Typography.Text>

      <Space wrap style={{ margin: '24px 0 16px', width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Input
            allowClear
            placeholder="Search client or lead ID..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280 }}
          />
          <Select
            allowClear
            placeholder="All Stages"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            style={{ width: 180 }}
          />
          <Select
            allowClear
            placeholder="All Products"
            value={productFilter}
            onChange={setProductFilter}
            options={PRODUCTS}
            style={{ width: 180 }}
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={setDateRange}
            allowClear
            style={{ width: 240 }}
          />
          {(search || statusFilter || productFilter || dateRange) && (
            <Button onClick={() => { setSearch(''); setStatusFilter(undefined); setProductFilter(undefined); setDateRange(null); }}>
              Clear Filters
            </Button>
          )}
        </Space>
        <Typography.Text type="secondary">{filtered.length} shown</Typography.Text>
      </Space>

      <Tabs
        activeKey={leadsTab}
        onChange={setLeadsTab}
        style={{ marginBottom: 8 }}
        items={[
          { key: 'active', label: `Active (${activeCount})` },
          { key: 'archive', label: `Archive (${archiveCount})` },
        ]}
      />
      <Table size="small" rowKey="_id" loading={loading} dataSource={filtered} columns={columns} scroll={{ x: 'max-content' }} onRow={(row) => ({ onClick: () => navigate(`/admin/leads/${row._id}`), style: { cursor: 'pointer' } })} />

      <SendToAgencyModal
        open={sendOpen}
        onClose={() => setSendOpen(false)}
        lead={sendingLead}
        onSent={load}
      />

      <Modal
        title="Payout History"
        open={historyOpen}
        onCancel={() => setHistoryOpen(false)}
        footer={<Button onClick={() => setHistoryOpen(false)}>Close</Button>}
        width={520}
      >
        {historyLead && (
          <>
            <Descriptions size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Client">{historyLead.customerName}</Descriptions.Item>
              <Descriptions.Item label="Agent">{historyLead.agent?.name || historyLead.agent?.email}</Descriptions.Item>
              {historyLead.disbursementReceipt && (
                <Descriptions.Item label="Receipt Ref" span={2}>{historyLead.disbursementReceipt}</Descriptions.Item>
              )}
            </Descriptions>
            {historyLead.payoutHistory?.length > 0 ? (
              <Timeline
                items={[...historyLead.payoutHistory].reverse().map((p) => ({
                  color: 'green',
                  children: (
                    <div>
                      <div style={{ fontWeight: 600 }}>{aed(p.amount)}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        {new Date(p.sentAt).toLocaleString()} · {p.month}
                      </div>
                    </div>
                  ),
                }))}
              />
            ) : (
              <Typography.Text type="secondary">No payout history yet.</Typography.Text>
            )}
          </>
        )}
      </Modal>

    </>
  );
}

export default AdminLeads;
