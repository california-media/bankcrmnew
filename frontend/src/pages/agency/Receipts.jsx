import { useEffect, useMemo, useState } from 'react';
import {
  Table, Tag, Typography, Button, Input, Space, message, Modal, Form,
  Upload, Descriptions, Row, Col, Statistic, Card, Badge,
} from 'antd';
import { SearchOutlined, FileTextOutlined, UploadOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export default function AgencyReceipts() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // Modal — handles both single and bulk
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLeads, setModalLeads] = useState([]); // 1 = single, N = bulk
  const [receiptForm] = Form.useForm();
  const [receiptFileList, setReceiptFileList] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/leads/agency');
      setLeads(data.filter((l) => l.status === 'disbursed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openModal = (targetLeads) => {
    setModalLeads(targetLeads);
    receiptForm.setFieldsValue({
      receipt: targetLeads.length === 1 ? (targetLeads[0].disbursementReceipt || '') : '',
    });
    setReceiptFileList([]);
    setModalOpen(true);
  };

  const saveReceipt = async () => {
    const { receipt } = receiptForm.getFieldsValue();
    if (!receipt && receiptFileList.length === 0) {
      message.error('Add a reference number or upload a file');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      if (receipt) formData.append('receipt', receipt);
      if (receiptFileList[0]?.originFileObj) formData.append('receiptFile', receiptFileList[0].originFileObj);

      if (modalLeads.length === 1) {
        await api.patch(`/leads/${modalLeads[0]._id}/receipt`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        message.success('Receipt saved');
      } else {
        formData.append('leadIds', JSON.stringify(modalLeads.map((l) => l._id)));
        const { data } = await api.post('/leads/bulk-receipt', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        message.success(`Receipt applied to ${data.count} leads`);
        setSelectedRowKeys([]);
      }

      setModalOpen(false);
      setReceiptFileList([]);
      receiptForm.resetFields();
      load();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (q && !l.customerName.toLowerCase().includes(q) && !(l.leadNumber || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [leads, search]);

  const stats = useMemo(() => ({
    total: leads.length,
    submitted: leads.filter((l) => l.disbursementReceipt || l.disbursementReceiptFile).length,
    missing: leads.filter((l) => !l.disbursementReceipt && !l.disbursementReceiptFile).length,
  }), [leads]);

  const selectedLeads = useMemo(
    () => leads.filter((l) => selectedRowKeys.includes(l._id)),
    [leads, selectedRowKeys],
  );

  const columns = [
    {
      title: 'Lead ID',
      dataIndex: 'leadNumber',
      render: (v) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace', width: 130, whiteSpace: 'nowrap' }}>{v || '—'}</Typography.Text>,
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
    { title: 'Agent', render: (_, row) => row.agent ? (row.agent.name || row.agent.email) : '—' },
    { title: 'Bank', render: (_, row) => row.bank?.name || '—' },
    {
      title: 'Product',
      render: (_, row) => {
        if (row.productType === 'loan') {
          return (
            <div>
              <div>{row.loanProduct?.name || 'Loan'}</div>
              <div style={{ fontSize: 12, color: '#888' }}>AED {Number(row.loanAmount || 0).toLocaleString()}</div>
            </div>
          );
        }
        return row.cardProduct?.name || 'Credit Card';
      },
    },
    {
      title: 'Receipt',
      render: (_, row) => {
        const hasReceipt = row.disbursementReceipt || row.disbursementReceiptFile;
        return hasReceipt ? (
          <Space direction="vertical" size={0}>
            <Tag color="green" icon={<CheckCircleOutlined />}>Submitted</Tag>
            {row.disbursementReceipt && (
              <Typography.Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                {row.disbursementReceipt}
              </Typography.Text>
            )}
            {row.disbursementReceiptFile && (
              <a
                href={`${API_BASE}/uploads/receipts/${row.disbursementReceiptFile}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11 }}
                onClick={(e) => e.stopPropagation()}
              >
                View file
              </a>
            )}
          </Space>
        ) : (
          <Tag color="warning" icon={<ClockCircleOutlined />}>Missing</Tag>
        );
      },
    },
    {
      title: 'Action',
      render: (_, row) => {
        const hasReceipt = row.disbursementReceipt || row.disbursementReceiptFile;
        return (
          <Badge dot={!hasReceipt} offset={[-2, 2]}>
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={(e) => { e.stopPropagation(); openModal([row]); }}
            >
              {hasReceipt ? 'Edit' : 'Add'}
            </Button>
          </Badge>
        );
      },
    },
  ];

  const isBulk = modalLeads.length > 1;

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Typography.Title level={4} style={{ margin: 0, fontWeight: 500 }}>Receipts</Typography.Title>
          <Typography.Text type="secondary">
            Upload disbursement receipts. Select multiple leads to upload one receipt for all at once.
          </Typography.Text>
        </Col>
        <Col>
          {selectedRowKeys.length > 0 && (
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={() => openModal(selectedLeads)}
            >
              Upload Receipt for Selected ({selectedRowKeys.length})
            </Button>
          )}
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Total Disbursed" value={stats.total} valueStyle={{ fontWeight: 700 }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Receipts Submitted" value={stats.submitted} valueStyle={{ color: '#16a34a', fontWeight: 700 }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Receipts Missing"
              value={stats.missing}
              valueStyle={{ color: stats.missing > 0 ? '#d97706' : '#16a34a', fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 16 }}>
        <Input
          allowClear
          placeholder="Search client or lead ID..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280 }}
        />
        <Typography.Text type="secondary">{filtered.length} records</Typography.Text>
      </Space>

      <Table
        size="small"
        rowKey="_id"
        loading={loading}
        dataSource={filtered}
        columns={columns}
        scroll={{ x: 'max-content' }}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        onRow={(row) => ({ onClick: () => navigate(`/agency/leads/${row._id}`), style: { cursor: 'pointer' } })}
      />

      <Modal
        title={isBulk ? `Upload Receipt for ${modalLeads.length} Leads` : 'Disbursement Receipt'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setReceiptFileList([]); }}
        onOk={saveReceipt}
        okText="Save"
        confirmLoading={saving}
        destroyOnClose
      >
        {isBulk ? (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f0f9ff', borderRadius: 6, border: '1px solid #bae6fd' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              This receipt (reference + file) will be applied to all {modalLeads.length} selected leads.
            </Typography.Text>
            <div style={{ marginTop: 6, fontSize: 12, color: '#555' }}>
              {modalLeads.map((l) => (
                <div key={l._id}>{l.customerName} — {l.leadNumber || l._id}</div>
              ))}
            </div>
          </div>
        ) : modalLeads[0] && (
          <Descriptions size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Client">{modalLeads[0].customerName}</Descriptions.Item>
            <Descriptions.Item label="Bank">{modalLeads[0].bank?.name}</Descriptions.Item>
          </Descriptions>
        )}
        <Form form={receiptForm} layout="vertical">
          <Form.Item name="receipt" label="Reference Number (optional)">
            <Input placeholder="e.g. TXN-2025-001234" />
          </Form.Item>
          <Form.Item label="Receipt File (optional — JPG, PNG, PDF, max 10 MB)">
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
        </Form>
        {!isBulk && modalLeads[0]?.disbursementReceiptAt && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Last updated: {new Date(modalLeads[0].disbursementReceiptAt).toLocaleString()}
          </Typography.Text>
        )}
      </Modal>
    </>
  );
}
