import { useEffect, useMemo, useState } from 'react';
import {
  Table, Tag, Typography, Button, Input, Tabs, Space, message, Popconfirm,
  Row, Col, Card, Modal, Form, InputNumber, Divider,
} from 'antd';
import {
  SearchOutlined, DollarOutlined, CheckCircleOutlined, LockOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const COMM_COLORS = { payable: 'cyan', pending: 'gold', paid: 'green', none: 'default' };
const COMM_LABELS = { payable: 'Payout Ready for Agent', pending: 'Pending', paid: 'Paid', none: '—' };

export default function Payouts() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [holds, setHolds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [holdsLoading, setHoldsLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('payable');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedHoldKeys, setSelectedHoldKeys] = useState([]);

  // Pay modal state
  const [payModal, setPayModal] = useState({ open: false, ids: null }); // ids=null means all payable
  const [holdPct, setHoldPct] = useState(10);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads');
      setLeads(data.filter((l) => l.commissionStatus !== 'none'));
    } finally {
      setLoading(false);
    }
  };

  const loadHolds = async () => {
    setHoldsLoading(true);
    try {
      const { data } = await api.get('/leads/holds');
      setHolds(data);
    } catch {
      message.error('Failed to load holds');
    } finally {
      setHoldsLoading(false);
    }
  };

  useEffect(() => { load(); loadHolds(); }, []);

  const openPayModal = (ids) => {
    setHoldPct(10);
    setPayModal({ open: true, ids });
  };

  const confirmPay = async () => {
    setPaying(true);
    try {
      const body = payModal.ids ? { leadIds: payModal.ids, holdPct } : { holdPct };
      const { data } = await api.post('/leads/bulk-mark-paid', body);
      message.success(`${data.count} payout(s) sent`);
      setSelectedRowKeys([]);
      setPayModal({ open: false, ids: null });
      load();
      loadHolds();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    } finally {
      setPaying(false);
    }
  };

  const releaseHold = async (leadId) => {
    try {
      await api.post(`/leads/${leadId}/release-hold`);
      message.success('Hold released');
      loadHolds();
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to release hold');
    }
  };

  const bulkRelease = async (ids) => {
    setReleasing(true);
    try {
      const body = ids ? { leadIds: ids } : {};
      const { data } = await api.post('/leads/bulk-release-holds', body);
      message.success(`${data.count} hold(s) released`);
      setSelectedHoldKeys([]);
      loadHolds();
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to release holds');
    } finally {
      setReleasing(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (tab === 'payable' && l.commissionStatus !== 'payable') return false;
      if (tab === 'paid' && l.commissionStatus !== 'paid') return false;
      if (q && !l.customerName.toLowerCase().includes(q) && !(l.leadNumber || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [leads, search, tab]);

  const payableLeads = useMemo(() => leads.filter((l) => l.commissionStatus === 'payable'), [leads]);

  const stats = useMemo(() => ({
    payable: payableLeads.length,
    paid:    leads.filter((l) => l.commissionStatus === 'paid').length,
    totalPayable: payableLeads.reduce((s, l) => s + (l.commission || 0), 0),
    totalPaid: leads.filter((l) => l.commissionStatus === 'paid').reduce((s, l) => {
      const held = l.holdAmount > 0 && !l.holdReleased ? (l.holdAmount || 0) : 0;
      return s + (l.commission || 0) - held;
    }, 0),
    totalHeld: holds.reduce((s, l) => s + (l.holdAmount || 0), 0),
  }), [leads, payableLeads, holds]);

  const selectedPayable = useMemo(
    () => selectedRowKeys.filter((id) => payableLeads.some((l) => l._id === id)),
    [selectedRowKeys, payableLeads],
  );

  // For the pay modal preview
  const modalLeads = useMemo(() => {
    if (!payModal.open) return [];
    return payModal.ids ? payableLeads.filter((l) => payModal.ids.includes(l._id)) : payableLeads;
  }, [payModal, payableLeads]);

  const modalCardLeads = modalLeads.filter((l) => l.productType === 'credit_card');
  const modalTotal = modalLeads.reduce((s, l) => s + (l.commission || 0), 0);
  const holdAmount = holdPct > 0 ? Math.round(modalCardLeads.reduce((s, l) => s + (l.commission || 0), 0) * holdPct / 100) : 0;
  const netPayout = modalTotal - holdAmount;

  const paidRows = useMemo(() => {
    const src = leads.filter((l) => {
      const q = search.trim().toLowerCase();
      if (l.commissionStatus !== 'paid') return false;
      if (q && !l.customerName.toLowerCase().includes(q) && !(l.leadNumber || '').toLowerCase().includes(q)) return false;
      return true;
    });
    const rows = [];
    src.forEach((l) => {
      const holdAmt = l.holdAmount || 0;
      const stillHeld = holdAmt > 0 && !l.holdReleased;
      rows.push({ ...l, _rowKey: `${l._id}_pay`, _type: 'payout', _amount: (l.commission || 0) - holdAmt, _date: l.commissionPaidAt });
      if (holdAmt > 0 && l.holdReleased) {
        rows.push({ ...l, _rowKey: `${l._id}_hold`, _type: 'hold_release', _amount: holdAmt, _date: l.holdReleasedAt });
      }
    });
    return rows.sort((a, b) => new Date(b._date || 0) - new Date(a._date || 0));
  }, [leads, search]);

  const adminPaidColumns = [
    {
      title: 'Lead ID',
      dataIndex: 'leadNumber',
      render: (v) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{v || '—'}</Typography.Text>,
    },
    {
      title: 'Client',
      dataIndex: 'customerName',
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{row.phone}</div>
        </div>
      ),
    },
    {
      title: 'Agent',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.agent?.name || row.agent?.email || '—'}</div>
          {row.agent?.name && <div style={{ fontSize: 12, color: '#94a3b8' }}>{row.agent.email}</div>}
        </div>
      ),
    },
    { title: 'Agency', render: (_, row) => row.agency?.name || row.agency?.email || '—' },
    { title: 'Bank', render: (_, row) => row.bank?.name || '—' },
    {
      title: 'Type',
      render: (_, row) => row._type === 'hold_release'
        ? <Tag color="purple" style={{ fontSize: 11 }}>Hold Released</Tag>
        : <Tag color="green" style={{ fontSize: 11 }}>Payout</Tag>,
    },
    {
      title: 'Amount',
      align: 'right',
      render: (_, row) => (
        <span style={{ color: row._type === 'hold_release' ? '#7c3aed' : '#16a34a', fontWeight: 700, fontSize: 14 }}>
          {aed(row._amount)}
        </span>
      ),
    },
    {
      title: 'Date',
      render: (_, row) => row._date
        ? new Date(row._date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
        : '—',
    },
  ];

  const columns = [
    {
      title: 'Lead ID',
      dataIndex: 'leadNumber',
      render: (v) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{v || '—'}</Typography.Text>,
    },
    {
      title: 'Client',
      dataIndex: 'customerName',
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{v}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{row.phone}</div>
        </div>
      ),
    },
    {
      title: 'Agent',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.agent?.name || row.agent?.email || '—'}</div>
          {row.agent?.name && <div style={{ fontSize: 12, color: '#94a3b8' }}>{row.agent.email}</div>}
        </div>
      ),
    },
    { title: 'Agency', render: (_, row) => row.agency?.name || row.agency?.email || '—' },
    { title: 'Bank', render: (_, row) => row.bank?.name || '—' },
    {
      title: 'Commission',
      align: 'right',
      render: (_, row) => {
        const held = row.holdAmount > 0 && !row.holdReleased ? (row.holdAmount || 0) : 0;
        const actual = (row.commission || 0) - held;
        return (
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{aed(row.commissionStatus === 'paid' ? actual : row.commission)}</div>
            {row.commissionStatus === 'paid' && held > 0 && (
              <div style={{ fontSize: 11, color: '#f59e0b' }}>+{aed(held)} on hold</div>
            )}
            {row.grossCommission > 0 && (
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Gross: {aed(row.grossCommission)}</div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'commissionStatus',
      render: (s) => <Tag color={COMM_COLORS[s]}>{COMM_LABELS[s]}</Tag>,
    },
    {
      title: 'Paid On',
      dataIndex: 'commissionPaidAt',
      render: (d) => d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    },
  ];

  const holdColumns = [
    {
      title: 'Lead ID',
      dataIndex: 'leadNumber',
      render: (v) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>{v || '—'}</Typography.Text>,
    },
    { title: 'Client', dataIndex: 'customerName', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    {
      title: 'Agent',
      render: (_, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.agent?.name || row.agent?.email || '—'}</div>
          {row.agent?.name && <div style={{ fontSize: 12, color: '#94a3b8' }}>{row.agent.email}</div>}
        </div>
      ),
    },
    { title: 'Bank', render: (_, row) => row.bank?.name || '—' },
    {
      title: 'Clawback Until',
      render: (_, row) => {
        if (!row.clawbackUntil) return <span style={{ color: '#94a3b8' }}>—</span>;
        const until = new Date(row.clawbackUntil);
        const daysLeft = Math.ceil((until - Date.now()) / 86400000);
        return (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#b45309' }}>
              {until.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            {daysLeft > 0
              ? <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 1 }}>{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</div>
              : <div style={{ fontSize: 11, color: '#16a34a', marginTop: 1 }}>Clawback expired</div>
            }
          </div>
        );
      },
    },
    { title: 'Commission', align: 'right', render: (_, row) => <span style={{ fontWeight: 700 }}>{aed(row.commission)}</span> },
    {
      title: 'On Hold',
      align: 'right',
      render: (_, row) => <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: 14 }}>{aed(row.holdAmount)}</span>,
    },
    { title: 'Paid On', dataIndex: 'commissionPaidAt', render: (d) => d ? new Date(d).toLocaleDateString() : '—' },
    {
      title: 'Action',
      render: (_, row) => (
        <Popconfirm
          title="Release hold?"
          description={`Release ${aed(row.holdAmount)} to agent?`}
          onConfirm={() => releaseHold(row._id)}
          okText="Release"
        >
          <Button size="small" type="primary" ghost>Release</Button>
        </Popconfirm>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'payable',
      label: <span><DollarOutlined style={{ color: '#0891b2', marginRight: 5 }} />Payout Ready for Agent ({stats.payable})</span>,
    },
    {
      key: 'paid',
      label: <span><CheckCircleOutlined style={{ color: '#16a34a', marginRight: 5 }} />Paid ({stats.paid})</span>,
    },
    {
      key: 'holds',
      label: <span><LockOutlined style={{ color: '#f59e0b', marginRight: 5 }} />On Hold ({holds.length})</span>,
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Payouts</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {selectedPayable.length > 0 && (
            <Button type="primary" icon={<DollarOutlined />} onClick={() => openPayModal(selectedPayable)}>
              Pay Selected ({selectedPayable.length})
            </Button>
          )}
          {stats.payable > 0 && (
            <Button icon={<DollarOutlined />} onClick={() => openPayModal(null)}>
              Pay All Ready ({stats.payable})
            </Button>
          )}
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { color: '#0891b2', icon: <DollarOutlined />, label: 'PAYOUT READY FOR AGENT', value: aed(stats.totalPayable), sub: `${stats.payable} lead${stats.payable !== 1 ? 's' : ''} ready to pay` },
          { color: '#16a34a', icon: <CheckCircleOutlined />, label: 'TOTAL PAID OUT TO AGENT', value: aed(stats.totalPaid), sub: `${stats.paid} payout${stats.paid !== 1 ? 's' : ''} completed` },
          { color: '#f59e0b', icon: <LockOutlined />, label: 'TOTAL ON HOLD', value: aed(stats.totalHeld), sub: `${holds.length} hold${holds.length !== 1 ? 's' : ''} pending release` },
        ].map((s) => (
          <Col xs={24} sm={8} key={s.label}>
            <div
              style={{
                borderRadius: 14, border: '1px solid #edf0f7', borderTop: `3px solid ${s.color}`,
                background: `linear-gradient(170deg, ${s.color}12 0%, #ffffff 45%, #f8faff 100%)`,
                boxShadow: '0 4px 16px rgba(15,23,42,0.08)', padding: '18px 20px',
                transition: 'box-shadow 0.2s, transform 0.2s', cursor: 'default',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 8px 24px ${s.color}28`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(15,23,42,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8' }}>{s.label}</div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, fontSize: 16 }}>{s.icon}</div>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1e293b', lineHeight: 1.2 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{s.sub}</div>
            </div>
          </Col>
        ))}
      </Row>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '0 24px 24px' }}>
        <Tabs
          activeKey={tab}
          onChange={(k) => { setTab(k); setSelectedRowKeys([]); setSelectedHoldKeys([]); }}
          items={tabItems}
          style={{ marginBottom: 0 }}
        />
        {tab !== 'holds' && (
          <Space style={{ marginBottom: 16 }}>
            <Input
              allowClear
              placeholder="Search client or lead ID..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 280 }}
            />
            <Typography.Text type="secondary">{tab === 'paid' ? paidRows.length : filtered.length} records</Typography.Text>
          </Space>
        )}
        {tab === 'holds' ? (
          <>
            {holds.length > 0 && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
                {selectedHoldKeys.length > 0 && (
                  <Popconfirm
                    title={`Release ${selectedHoldKeys.length} hold(s)?`}
                    description={`This will release ${aed(holds.filter(h => selectedHoldKeys.includes(h._id)).reduce((s, h) => s + (h.holdAmount || 0), 0))} to agents.`}
                    onConfirm={() => bulkRelease(selectedHoldKeys)}
                    okText="Release"
                    okButtonProps={{ danger: false }}
                  >
                    <Button
                      type="primary"
                      icon={<LockOutlined />}
                      loading={releasing}
                      style={{ background: '#f59e0b', borderColor: '#f59e0b' }}
                    >
                      Release Selected ({selectedHoldKeys.length})
                    </Button>
                  </Popconfirm>
                )}
                <Popconfirm
                  title={`Release all ${holds.length} holds?`}
                  description={`This will release ${aed(stats.totalHeld)} total to agents.`}
                  onConfirm={() => bulkRelease(null)}
                  okText="Release All"
                  okButtonProps={{ danger: false }}
                >
                  <Button icon={<LockOutlined />} loading={releasing}>
                    Release All ({holds.length})
                  </Button>
                </Popconfirm>
                {selectedHoldKeys.length > 0 && (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {selectedHoldKeys.length} selected · {aed(holds.filter(h => selectedHoldKeys.includes(h._id)).reduce((s, h) => s + (h.holdAmount || 0), 0))} held
                  </Typography.Text>
                )}
              </div>
            )}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <Table
                size="small"
                rowKey="_id"
                loading={holdsLoading}
                dataSource={holds}
                columns={holdColumns}
                rowSelection={{ selectedRowKeys: selectedHoldKeys, onChange: setSelectedHoldKeys }}
                locale={{ emptyText: 'No active holds' }}
              />
            </div>
          </>
        ) : (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <Table
              size="small"
              rowKey={tab === 'paid' ? '_rowKey' : '_id'}
              loading={loading}
              dataSource={tab === 'paid' ? paidRows : filtered}
              columns={tab === 'paid' ? adminPaidColumns : columns}
              rowSelection={
                tab === 'payable'
                  ? { selectedRowKeys, onChange: setSelectedRowKeys, getCheckboxProps: (row) => ({ disabled: row.commissionStatus !== 'payable' }) }
                  : undefined
              }
            />
          </div>
        )}
      </div>

      {/* Pay Modal */}
      <Modal
        title="Confirm Payout"
        open={payModal.open}
        onCancel={() => setPayModal({ open: false, ids: null })}
        onOk={confirmPay}
        okText="Confirm & Pay"
        confirmLoading={paying}
        okButtonProps={{ type: 'primary' }}
        destroyOnClose
        width={480}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <Typography.Text type="secondary">Leads to pay</Typography.Text>
            <Typography.Text strong>{modalLeads.length}</Typography.Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <Typography.Text type="secondary">Total commission</Typography.Text>
            <Typography.Text strong>{aed(modalTotal)}</Typography.Text>
          </div>
          {modalCardLeads.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <Typography.Text type="secondary">Credit card leads</Typography.Text>
              <Typography.Text>{modalCardLeads.length}</Typography.Text>
            </div>
          )}
        </div>

        {modalCardLeads.length > 0 && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <LockOutlined /> Hold Amount (Credit Cards Only)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <InputNumber
                  min={0}
                  max={100}
                  value={holdPct}
                  onChange={(v) => setHoldPct(v || 0)}
                  formatter={(v) => `${v}%`}
                  parser={(v) => v.replace('%', '')}
                  style={{ width: 110 }}
                  placeholder="0%"
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  of credit card commissions (set 0 to skip)
                </Typography.Text>
              </div>
              {holdPct > 0 && (
                <div style={{ fontSize: 12, color: '#b45309' }}>
                  <div>Hold: <strong>{aed(holdAmount)}</strong></div>
                  <div>Net paid: <strong>{aed(netPayout)}</strong></div>
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
          <InfoCircleOutlined />
          {holdPct > 0
            ? `Agent receives ${aed(netPayout)}. ${aed(holdAmount)} held until clawback period expires.`
            : 'Full commission will be paid to agents.'}
        </div>
      </Modal>
    </>
  );
}
