import { useEffect, useState, useMemo } from 'react';
import {
  Table, Tag, Typography, Button, Input, InputNumber, Form, Modal, Segmented,
  Space, message, Tabs, Card, Row, Col, Descriptions, Divider, Alert, Upload, Statistic,
} from 'antd';
import {
  WalletOutlined, CheckOutlined, HistoryOutlined, UploadOutlined, PaperClipOutlined,
  ClockCircleOutlined, CheckCircleOutlined, TransactionOutlined, PlusOutlined,
} from '@ant-design/icons';

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:5000';
import dayjs from 'dayjs';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

function AgencyPayouts() {
  const [tab, setTab] = useState('pending');

  const [pendingLeads, setPendingLeads] = useState([]);
  const [history, setHistory] = useState([]);
  const [bucketBalance, setBucketBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [receiptFileList, setReceiptFileList] = useState([]);

  const [walletOpen, setWalletOpen] = useState(false);
  const [walletForm] = Form.useForm();
  const [walletFileList, setWalletFileList] = useState([]);
  const [walletSubmitting, setWalletSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('bank'); // 'bank' | 'bucket'
  const [bucketRequests, setBucketRequests] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [pendRes, histRes, bucketRes, reqRes] = await Promise.allSettled([
        api.get('/agency-payouts/pending'),
        api.get('/agency-payouts/history'),
        api.get('/agency-payouts/bucket'),
        api.get('/agency-payouts/bucket-requests'),
      ]);
      if (pendRes.status === 'fulfilled')   setPendingLeads(pendRes.value.data);
      if (histRes.status === 'fulfilled')   setHistory(histRes.value.data);
      if (bucketRes.status === 'fulfilled') setBucketBalance(bucketRes.value.data.bucketBalance || 0);
      if (reqRes.status === 'fulfilled')    setBucketRequests(reqRes.value.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const pendingTotal = useMemo(
    () => pendingLeads.reduce((s, l) => s + (l.grossCommission || 0), 0),
    [pendingLeads]
  );
  const paidTotal = useMemo(
    () => history.reduce((s, h) => s + (h.amountPaid || 0), 0),
    [history]
  );

  const selectedLeads = useMemo(
    () => pendingLeads.filter((l) => selectedRowKeys.includes(l._id)),
    [pendingLeads, selectedRowKeys]
  );
  const selectedTotal = useMemo(
    () => selectedLeads.reduce((sum, l) => sum + (l.grossCommission || 0), 0),
    [selectedLeads]
  );

  const handleWalletSubmit = async () => {
    let values;
    try { values = await walletForm.validateFields(); } catch { return; }
    setWalletSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('amount', values.amount);
      if (values.note) formData.append('note', values.note);
      if (walletFileList[0]?.originFileObj) formData.append('receiptFile', walletFileList[0].originFileObj);
      await api.post('/agency-payouts/add-wallet', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success('Top-up request submitted — pending admin approval');
      setWalletOpen(false);
      walletForm.resetFields();
      setWalletFileList([]);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    } finally {
      setWalletSubmitting(false);
    }
  };

  const openPayoutModal = () => {
    payoutForm.resetFields();
    setReceiptFileList([]);
    setPaymentMethod('bank');
    setPayoutOpen(true);
  };

  const handleSubmit = async () => {
    let values;
    try { values = await payoutForm.validateFields(); } catch { return; }
    setSubmitting(true);
    try {
      const { amountPaid, receiptNote } = values;
      const bucketDeduct = paymentMethod === 'bucket' ? Math.min(selectedTotal, bucketBalance) : 0;
      const bankAmount   = paymentMethod === 'bank'   ? (amountPaid || 0) : 0;
      const formData = new FormData();
      formData.append('leadIds', JSON.stringify(selectedRowKeys));
      formData.append('amountPaid', bankAmount);
      formData.append('bucketUsedAmount', bucketDeduct);
      if (receiptNote) formData.append('receiptNote', receiptNote);
      if (receiptFileList[0]?.originFileObj) formData.append('receiptFile', receiptFileList[0].originFileObj);

      const res = await api.post('/agency-payouts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success('Payout submitted successfully');
      setBucketBalance(res.data.bucketBalance);
      setSelectedRowKeys([]);
      setReceiptFileList([]);
      setPayoutOpen(false);
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const newLeads = useMemo(() => pendingLeads.filter((l) => l.agencyPaymentStatus === 'pending'), [pendingLeads]);
  const submittedLeads = useMemo(() => pendingLeads.filter((l) => l.agencyPaymentStatus === 'agency_paid'), [pendingLeads]);

  const pendingColumns = [
    {
      title: 'Lead ID',
      dataIndex: 'leadNumber',
      width: 130,
      render: (v) => (
        <Typography.Text type="secondary" style={{ fontFamily: 'monospace' }}>{v || '—'}</Typography.Text>
      ),
    },
    {
      title: 'Client',
      dataIndex: 'customerName',
      render: (v, row) => (
        <div style={{ lineHeight: 1.3 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{v}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{row.phone}</div>
        </div>
      ),
    },
    { title: 'Bank', dataIndex: ['bank', 'name'] },
    {
      title: 'Product',
      render: (_, row) => {
        if (row.productType === 'credit_card' && row.cardProduct)
          return <span style={{ fontSize: 12 }}>{row.cardProduct.name}</span>;
        if (row.productType === 'loan' && row.loanProduct)
          return <span style={{ fontSize: 12 }}>{row.loanProduct.name}</span>;
        return row.productType;
      },
    },
    {
      title: 'Gross Commission',
      dataIndex: 'grossCommission',
      align: 'right',
      render: (v) => <Typography.Text strong>{aed(v)}</Typography.Text>,
    },
    {
      title: 'Disbursed',
      dataIndex: 'updatedAt',
      render: (v) => dayjs(v).format('DD MMM YYYY'),
    },
  ];

  const historyColumns = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      render: (v) => dayjs(v).format('DD MMM YYYY, HH:mm'),
    },
    {
      title: 'Leads',
      dataIndex: 'leads',
      render: (leads) => (
        <Space direction="vertical" size={2}>
          <Tag>{leads.length} lead{leads.length !== 1 ? 's' : ''}</Tag>
          {leads.map((l) => (
            <Typography.Text key={l._id} style={{ fontSize: 11, color: '#475569', display: 'block' }}>
              {l.customerName || l.leadNumber || l._id}
            </Typography.Text>
          ))}
        </Space>
      ),
    },
    {
      title: 'Total Due',
      dataIndex: 'totalSelected',
      align: 'right',
      render: (v) => aed(v),
    },
    {
      title: 'Bank Transfer',
      dataIndex: 'amountPaid',
      align: 'right',
      render: (v) => <Typography.Text strong>{aed(v)}</Typography.Text>,
    },
    {
      title: 'Bucket Used',
      dataIndex: 'bucketUsed',
      align: 'right',
      render: (v) => v > 0 ? <Tag color="blue">{aed(v)}</Tag> : '—',
    },
    {
      title: 'Bucket Added',
      dataIndex: 'bucketAdded',
      align: 'right',
      render: (v) => v > 0 ? <Tag color="green">+{aed(v)}</Tag> : '—',
    },
    {
      title: 'Receipt',
      render: (_, row) => {
        if (row.receiptFile) {
          return (
            <a
              href={`${API_BASE}/uploads/receipts/${row.receiptFile}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <PaperClipOutlined /> View file
            </a>
          );
        }
        return row.receiptNote
          ? <Typography.Text style={{ fontSize: 12 }}>{row.receiptNote}</Typography.Text>
          : <Typography.Text type="secondary">—</Typography.Text>;
      },
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#0f172a' }}>Payouts to Admin</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { walletForm.resetFields(); setWalletFileList([]); setWalletOpen(true); }}
          style={{ background: '#4f46e5', borderColor: '#4f46e5' }}
        >
          Add to Wallet
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{ borderRadius: 10, borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}
            styles={{ body: { padding: '14px 16px' } }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, color: '#92400e' }}><ClockCircleOutlined style={{ marginRight: 5 }} />Pending Amount</span>}
              value={pendingTotal}
              prefix="AED"
              formatter={(v) => Number(v).toLocaleString()}
              valueStyle={{ color: '#b45309', fontWeight: 800, fontSize: 18 }}
            />
            <div style={{ fontSize: 11, color: '#a16207', marginTop: 2 }}>
              {newLeads.length} unpaid · {submittedLeads.length} submitted
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{ borderRadius: 10, borderLeft: '4px solid #22c55e', background: '#f0fdf4' }}
            styles={{ body: { padding: '14px 16px' } }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, color: '#15803d' }}><CheckCircleOutlined style={{ marginRight: 5 }} />Total Paid to Admin</span>}
              value={paidTotal}
              prefix="AED"
              formatter={(v) => Number(v).toLocaleString()}
              valueStyle={{ color: '#16a34a', fontWeight: 800, fontSize: 18 }}
            />
            <div style={{ fontSize: 11, color: '#15803d', marginTop: 2 }}>{history.length} payout{history.length !== 1 ? 's' : ''} submitted</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{ borderRadius: 10, borderLeft: '4px solid #6366f1', background: '#eef2ff' }}
            styles={{ body: { padding: '14px 16px' } }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, color: '#4f46e5' }}><WalletOutlined style={{ marginRight: 5 }} />Bucket Balance</span>}
              value={bucketBalance}
              prefix="AED"
              formatter={(v) => Number(v).toLocaleString()}
              valueStyle={{ color: '#4f46e5', fontWeight: 800, fontSize: 18 }}
            />
            <div style={{ fontSize: 11, color: '#6366f1', marginTop: 2 }}>Available as credit</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            size="small"
            style={{ borderRadius: 10, borderLeft: '4px solid #06b6d4', background: '#ecfeff' }}
            styles={{ body: { padding: '14px 16px' } }}
          >
            <Statistic
              title={<span style={{ fontSize: 12, color: '#0e7490' }}><TransactionOutlined style={{ marginRight: 5 }} />Net Outstanding</span>}
              value={Math.max(0, pendingTotal - bucketBalance)}
              prefix="AED"
              formatter={(v) => Number(v).toLocaleString()}
              valueStyle={{ color: '#0891b2', fontWeight: 800, fontSize: 18 }}
            />
            <div style={{ fontSize: 11, color: '#0e7490', marginTop: 2 }}>Pending minus bucket</div>
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'pending',
            label: <span><ClockCircleOutlined style={{ color: '#d97706' }} /> Pending Payouts ({newLeads.length})</span>,
            children: (
              <>
                {selectedRowKeys.length > 0 && (
                  <Alert
                    style={{ marginBottom: 12, borderRadius: 8 }}
                    type="warning"
                    message={
                      <Space size={24}>
                        <span>{selectedRowKeys.length} lead(s) selected</span>
                        <span style={{ fontWeight: 700 }}>Total due: {aed(selectedTotal)}</span>
                        <Button type="primary" size="small" onClick={openPayoutModal}>
                          Submit Payout
                        </Button>
                      </Space>
                    }
                  />
                )}
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  <Table
                    size="small"
                    rowKey="_id"
                    loading={loading}
                    dataSource={newLeads}
                    columns={pendingColumns}
                    scroll={{ x: 860 }}
                    rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
                    pagination={{ pageSize: 15, showSizeChanger: false }}
                    summary={(data) => {
                      const total = data.reduce((s, r) => s + (r.grossCommission || 0), 0);
                      return (
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0} colSpan={4} />
                          <Table.Summary.Cell index={4} align="right">
                            <Typography.Text strong>Total: {aed(total)}</Typography.Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={5} />
                          <Table.Summary.Cell index={6} />
                        </Table.Summary.Row>
                      );
                    }}
                  />
                </div>
              </>
            ),
          },
          {
            key: 'awaiting',
            label: <span><CheckCircleOutlined style={{ color: '#2563eb' }} /> Awaiting Admin ({submittedLeads.length})</span>,
            children: (
              <>
                <Alert
                  style={{ marginBottom: 12, borderRadius: 8 }}
                  type="info"
                  showIcon
                  message="These leads have been submitted to admin. Once admin confirms receipt, they will move to agent payout queue."
                />
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                  <Table
                    size="small"
                    rowKey="_id"
                    loading={loading}
                    dataSource={submittedLeads}
                    columns={pendingColumns}
                    scroll={{ x: 860 }}
                    pagination={{ pageSize: 15, showSizeChanger: false }}
                    summary={(data) => {
                      const total = data.reduce((s, r) => s + (r.grossCommission || 0), 0);
                      return (
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0} colSpan={4} />
                          <Table.Summary.Cell index={4} align="right">
                            <Typography.Text strong>Total: {aed(total)}</Typography.Text>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={5} />
                          <Table.Summary.Cell index={6} />
                        </Table.Summary.Row>
                      );
                    }}
                  />
                </div>
              </>
            ),
          },
          {
            key: 'history',
            label: <span><HistoryOutlined /> Paid History ({history.length})</span>,
            children: (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                <Table
                  size="small"
                  rowKey="_id"
                  loading={loading}
                  dataSource={history}
                  columns={historyColumns}
                  scroll={{ x: 860 }}
                  pagination={{ pageSize: 15, showSizeChanger: false }}
                />
              </div>
            ),
          },
          {
            key: 'bucket-requests',
            label: (
              <span>
                <WalletOutlined /> Wallet Requests ({bucketRequests.length})
                {bucketRequests.some((r) => r.status === 'pending') && (
                  <span style={{ marginLeft: 5, background: '#f59e0b', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '0 5px' }}>
                    {bucketRequests.filter((r) => r.status === 'pending').length}
                  </span>
                )}
              </span>
            ),
            children: (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
              <Table
                size="small"
                rowKey="_id"
                loading={loading}
                dataSource={bucketRequests}
                scroll={{ x: 700 }}
                pagination={{ pageSize: 15, showSizeChanger: false }}
                columns={[
                  {
                    title: 'Date',
                    dataIndex: 'createdAt',
                    render: (v) => dayjs(v).format('DD MMM YYYY, HH:mm'),
                  },
                  {
                    title: 'Amount',
                    dataIndex: 'amount',
                    align: 'right',
                    render: (v) => <Typography.Text strong style={{ color: '#4f46e5' }}>{aed(v)}</Typography.Text>,
                  },
                  {
                    title: 'Note',
                    dataIndex: 'note',
                    render: (v) => v || <Typography.Text type="secondary">—</Typography.Text>,
                  },
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    render: (v) => ({
                      pending:  <Tag color="gold">Pending Approval</Tag>,
                      approved: <Tag color="green">Approved</Tag>,
                      rejected: <Tag color="red">Rejected</Tag>,
                    }[v] || <Tag>{v}</Tag>),
                  },
                  {
                    title: 'Note / Reason',
                    render: (_, row) => {
                      if (row.status === 'rejected' && row.rejectionReason)
                        return <span style={{ fontSize: 12, color: '#dc2626' }}>{row.rejectionReason}</span>;
                      if (row.status === 'approved' && row.reviewedAt)
                        return <span style={{ fontSize: 12, color: '#16a34a' }}>Credited on {dayjs(row.reviewedAt).format('DD MMM, HH:mm')}</span>;
                      return <Typography.Text type="secondary" style={{ fontSize: 12 }}>Awaiting admin review</Typography.Text>;
                    },
                  },
                ]}
              />
              </div>
            ),
          },
        ]}
      />

      <Modal
        title="Submit Payout"
        open={payoutOpen}
        onCancel={() => { setPayoutOpen(false); setReceiptFileList([]); }}
        onOk={handleSubmit}
        okText="Submit"
        confirmLoading={submitting}
        destroyOnClose
        width={480}
      >
        <Descriptions size="small" column={1} style={{ marginBottom: 16 }} bordered>
          <Descriptions.Item label="Leads selected">{selectedRowKeys.length}</Descriptions.Item>
          <Descriptions.Item label="Total due">
            <Typography.Text strong style={{ fontSize: 15 }}>{aed(selectedTotal)}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Bucket balance">
            <Typography.Text style={{ color: '#4f46e5', fontWeight: 600 }}>{aed(bucketBalance)}</Typography.Text>
          </Descriptions.Item>
        </Descriptions>

        <Form form={payoutForm} layout="vertical">
          <Form.Item label="Payment Method" style={{ marginBottom: 14 }}>
            <Segmented
              block
              value={paymentMethod}
              onChange={(v) => { setPaymentMethod(v); payoutForm.resetFields(['amountPaid']); }}
              options={[
                { value: 'bank', label: 'Bank Transfer' },
                { value: 'bucket', label: `Bucket (${aed(bucketBalance)} available)`, disabled: bucketBalance <= 0 },
              ]}
            />
          </Form.Item>

          {paymentMethod === 'bank' && (
            <>
              <Form.Item
                name="amountPaid"
                label="Transfer Amount (AED)"
                rules={[{ required: true, message: 'Enter transfer amount' }]}
              >
                <InputNumber min={0} step={100} style={{ width: '100%' }} placeholder={String(selectedTotal)} />
              </Form.Item>
              <Form.Item name="receiptNote" label="Receipt / Reference Note">
                <Input.TextArea rows={2} placeholder="Transfer ref, receipt number..." />
              </Form.Item>
              <Form.Item label="Upload Receipt (JPG, PNG, PDF — max 10 MB)">
                <Upload
                  fileList={receiptFileList}
                  beforeUpload={() => false}
                  onChange={({ fileList }) => setReceiptFileList(fileList.slice(-1))}
                  accept=".jpg,.jpeg,.png,.pdf"
                  maxCount={1}
                >
                  <Button icon={<UploadOutlined />}>Select File</Button>
                </Upload>
              </Form.Item>
            </>
          )}

          {paymentMethod === 'bucket' && (
            <>
              <div style={{ background: '#eef2ff', borderRadius: 8, padding: '12px 14px', marginBottom: 14, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#4f46e5' }}>Bucket balance</span>
                  <span style={{ fontWeight: 700, color: '#4338ca' }}>{aed(bucketBalance)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Total due</span>
                  <span style={{ fontWeight: 700 }}>{aed(selectedTotal)}</span>
                </div>
                <Divider style={{ margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, color: bucketBalance >= selectedTotal ? '#15803d' : '#dc2626' }}>
                    {bucketBalance >= selectedTotal ? 'Remaining after deduction' : 'Shortfall (bucket insufficient)'}
                  </span>
                  <span style={{ fontWeight: 800, color: bucketBalance >= selectedTotal ? '#15803d' : '#dc2626' }}>
                    {bucketBalance >= selectedTotal
                      ? `+${aed(bucketBalance - selectedTotal)}`
                      : `-${aed(selectedTotal - bucketBalance)}`}
                  </span>
                </div>
              </div>
              <Form.Item name="receiptNote" label="Note (optional)">
                <Input.TextArea rows={2} placeholder="Reference note..." />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
      <Modal
        title={<span><WalletOutlined style={{ marginRight: 8, color: '#4f46e5' }} />Add to Wallet</span>}
        open={walletOpen}
        onCancel={() => { setWalletOpen(false); walletForm.resetFields(); setWalletFileList([]); }}
        onOk={handleWalletSubmit}
        okText="Submit Request"
        confirmLoading={walletSubmitting}
        destroyOnClose
        width={440}
      >
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
          Submit a top-up request with your payment receipt. Admin will review and credit the amount to your wallet.
        </Typography.Text>
        <div style={{ background: '#eef2ff', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600 }}><WalletOutlined style={{ marginRight: 5 }} />Current Balance</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#4338ca' }}>{aed(bucketBalance)}</span>
        </div>
        <Form form={walletForm} layout="vertical">
          <Form.Item
            name="amount"
            label="Amount to Add (AED)"
            rules={[{ required: true, message: 'Enter amount' }]}
          >
            <InputNumber min={1} step={100} style={{ width: '100%' }} placeholder="e.g. 500" />
          </Form.Item>
          <Form.Item name="note" label="Note (optional)">
            <Input.TextArea rows={2} placeholder="Bank transfer ref, deposit details..." />
          </Form.Item>
          <Form.Item label="Upload Receipt (optional)">
            <Upload
              fileList={walletFileList}
              beforeUpload={() => false}
              onChange={({ fileList }) => setWalletFileList(fileList.slice(-1))}
              accept=".jpg,.jpeg,.png,.pdf"
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default AgencyPayouts;
