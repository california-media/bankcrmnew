import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, Row, Col, Tag, Table, Typography, Button, Skeleton, Divider, Modal, Form, Input, message } from 'antd';
import {
  ArrowLeftOutlined, BankOutlined, UserOutlined, LockOutlined,
  CheckCircleOutlined, DollarOutlined, AuditOutlined, ClockCircleOutlined, EditOutlined,
} from '@ant-design/icons';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const InfoRow = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f1f5f9' }}>
    <span style={{ fontSize: 12, color: '#64748b' }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{value || '—'}</span>
  </div>
);

const BankField = ({ label, value }) => (
  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 600, color: value ? '#0f172a' : '#94a3b8' }}>{value || 'Not provided'}</div>
  </div>
);

const STATUS_COLORS = { draft: 'default', submitted: 'blue', under_review: 'gold', assigned: 'cyan', approved: 'green', rejected: 'red', disbursed: 'purple' };
const STATUS_LABELS = { draft: 'Draft', submitted: 'New Lead', under_review: 'Under Review', assigned: 'Assigned', approved: 'Approved', rejected: 'Rejected', disbursed: 'Disbursed' };

export default function AgentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    api.get(`/admin/agents/${id}`)
      .then((res) => setData(res.data))
      .catch(() => navigate('/admin/agents'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  const { agent, stats, leads } = data;
  const bd = agent.bankDetails || {};
  const hasBankDetails = !!(bd.iban || bd.accountNumber);

  const openEdit = () => {
    form.setFieldsValue({
      accountHolderName: bd.accountHolderName || '',
      bankName:          bd.bankName          || '',
      accountNumber:     bd.accountNumber     || '',
      iban:              bd.iban              || '',
      swiftCode:         bd.swiftCode         || '',
    });
    setEditModal(true);
  };

  const saveBankDetails = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await api.patch(`/admin/agents/${id}`, { bankDetails: values });
      setData((prev) => ({ ...prev, agent: res.data.user }));
      setEditModal(false);
      message.success('Bank details updated');
    } catch (err) {
      if (err?.response) message.error(err.response.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const statCards = [
    { label: 'Total Leads', value: stats.total, color: '#4f46e5', bg: '#eef2ff', icon: <AuditOutlined /> },
    { label: 'Approved', value: stats.approved, color: '#16a34a', bg: '#f0fdf4', icon: <CheckCircleOutlined /> },
    { label: 'Pending', value: stats.pending, color: '#f59e0b', bg: '#fffbeb', icon: <ClockCircleOutlined /> },
    { label: 'Commission Paid', value: aed(stats.paidCommission), color: '#7c3aed', bg: '#faf5ff', icon: <DollarOutlined /> },
  ];

  const columns = [
    { title: 'Lead ID', dataIndex: 'leadNumber', render: (v) => <Typography.Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 11 }}>{v || '—'}</Typography.Text> },
    { title: 'Client', dataIndex: 'customerName', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: 'Bank', render: (_, r) => r.bank?.name || '—' },
    { title: 'Type', dataIndex: 'productType', render: (v) => v === 'credit_card' ? 'Credit Card' : 'Loan' },
    { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s] || s}</Tag> },
    { title: 'Commission', align: 'right', render: (_, r) => <span style={{ fontWeight: 600, color: '#4f46e5' }}>{aed(r.commission)}</span> },
    { title: 'Date', dataIndex: 'createdAt', render: (d) => new Date(d).toLocaleDateString() },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Link to="/admin/agents"><Button icon={<ArrowLeftOutlined />} size="small">Back</Button></Link>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{agent.name || agent.email}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Agent profile & bank details</div>
        </div>
      </div>

      {/* Stat Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {statCards.map((s) => (
          <Col xs={12} sm={6} key={s.label}>
            <Card style={{ borderRadius: 14, border: 'none', background: s.bg, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }} styles={{ body: { padding: '16px 18px' } }}>
              <div style={{ fontSize: 20, color: s.color, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        {/* Left — Profile */}
        <Col xs={24} md={10}>
          <Card
            style={{ borderRadius: 16, border: '1px solid #e2e8f0', marginBottom: 16 }}
            styles={{ header: { borderBottom: '1px solid #f1f5f9' } }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserOutlined style={{ color: '#4f46e5' }} />
                <span style={{ fontWeight: 700 }}>Profile</span>
              </div>
            }
            extra={
              agent.isActive
                ? <Tag color="green">Active</Tag>
                : <Tag color="default">Inactive</Tag>
            }
          >
            <InfoRow label="Full Name" value={agent.name} />
            <InfoRow label="Email" value={agent.email} />
            <InfoRow label="Phone" value={agent.phone} />
            <InfoRow label="Referral Code" value={
              agent.referralCode
                ? <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1d4ed8', letterSpacing: 1 }}>{agent.referralCode}</span>
                : '—'
            } />
            {agent.holdPct > 0 && <InfoRow label="Hold %" value={<Tag color="orange" icon={<LockOutlined />}>{agent.holdPct}%</Tag>} />}
            <InfoRow label="Joined" value={new Date(agent.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })} />
            {agent.referredBy && (
              <InfoRow label="Referred By" value={agent.referredBy.name || agent.referredBy.email} />
            )}
          </Card>
        </Col>

        {/* Right — Bank Details */}
        <Col xs={24} md={14}>
          <Card
            style={{ borderRadius: 16, border: '1px solid #e2e8f0' }}
            styles={{ header: { borderBottom: '1px solid #f1f5f9' } }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BankOutlined style={{ color: '#3b82f6' }} />
                <span style={{ fontWeight: 700 }}>Bank Details</span>
                {hasBankDetails
                  ? <Tag color="green" style={{ marginLeft: 4 }}>Provided</Tag>
                  : <Tag color="orange" style={{ marginLeft: 4 }}>Not provided</Tag>
                }
              </div>
            }
            extra={<Button size="small" icon={<EditOutlined />} onClick={openEdit}>Edit</Button>}
          >
            {!hasBankDetails ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '32px 0', fontSize: 13 }}>
                Agent has not submitted bank details yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Row gutter={10}>
                  <Col xs={24} sm={12}><BankField label="Account Holder Name" value={bd.accountHolderName} /></Col>
                  <Col xs={24} sm={12}><BankField label="Bank Name" value={bd.bankName} /></Col>
                </Row>
                <Row gutter={10}>
                  <Col xs={24} sm={12}><BankField label="Account Number" value={bd.accountNumber} /></Col>
                  <Col xs={24} sm={12}><BankField label="IBAN" value={bd.iban} /></Col>
                </Row>
                <BankField label="SWIFT / BIC Code" value={bd.swiftCode} />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="Edit Bank Details"
        open={editModal}
        onCancel={() => setEditModal(false)}
        onOk={saveBankDetails}
        okText="Save"
        confirmLoading={saving}
        width={480}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="accountHolderName" label="Account Holder Name">
                <Input placeholder="Full name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bankName" label="Bank Name">
                <Input placeholder="Bank name" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="accountNumber" label="Account Number">
                <Input placeholder="Account number" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="iban" label="IBAN">
                <Input placeholder="IBAN" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="swiftCode" label="SWIFT / BIC Code">
            <Input placeholder="SWIFT code" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Recent Leads */}
      <Card
        style={{ borderRadius: 16, border: '1px solid #e2e8f0', marginTop: 16 }}
        styles={{ header: { borderBottom: '1px solid #f1f5f9' } }}
        title={<span style={{ fontWeight: 700 }}>Recent Leads</span>}
        extra={<Link to={`/admin/leads?agent=${id}`} style={{ fontSize: 13, color: '#4f46e5' }}>View all →</Link>}
      >
        <Table
          size="small"
          rowKey="_id"
          dataSource={leads}
          columns={columns}
          pagination={{ pageSize: 10, size: 'small' }}
          onRow={(row) => ({ onClick: () => navigate(`/admin/leads/${row._id}`), style: { cursor: 'pointer' } })}
          locale={{ emptyText: 'No leads yet' }}
        />
      </Card>
    </div>
  );
}
