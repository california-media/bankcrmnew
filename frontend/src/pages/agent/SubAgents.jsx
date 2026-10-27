import { useEffect, useState } from 'react';
import { Table, Tag, Row, Col, Typography, Button, message, Alert } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api/client';
import { aed } from '../../utils/dirham';

// Read-only: a super agent cannot add, edit or remove sub-agents. Agents join
// by entering the Super Agent Code when they register.
export default function SubAgents() {
  const [data, setData] = useState({ superAgentCode: '', subAgents: [] });
  const [earn, setEarn] = useState({ pending: 0, paid: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/super-agent/sub-agents'), api.get('/super-agent/earnings')])
      .then(([a, b]) => { setData(a.data); setEarn(b.data); })
      .catch(() => message.error('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const copy = () => {
    navigator.clipboard?.writeText(data.superAgentCode).then(() => message.success('Code copied'));
  };

  const stat = (label, value, color) => (
    <div style={{ borderRadius: 12, border: '1px solid #edf0f7', borderTop: `3px solid ${color}`, padding: '14px 18px', background: '#fff' }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{value}</div>
    </div>
  );

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 600, color: '#0f172a' }}>My Sub-Agents</h2>

      <Alert
        type="info" showIcon style={{ marginBottom: 16 }}
        message={
          <span>
            Your Super Agent Code: <b style={{ fontFamily: 'monospace', fontSize: 15 }}>{data.superAgentCode || '—'}</b>{' '}
            <Button size="small" type="link" icon={<CopyOutlined />} onClick={copy}>Copy</Button>
          </span>
        }
        description="Share this code. Agents who enter it while registering are attached to you, and you earn a commission on their approved leads."
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>{stat('PENDING COMMISSION', aed(earn.pending), '#f59e0b')}</Col>
        <Col xs={24} sm={8}>{stat('PAID COMMISSION', aed(earn.paid), '#16a34a')}</Col>
        <Col xs={24} sm={8}>{stat('SUB-AGENTS', data.subAgents.length, '#7c3aed')}</Col>
      </Row>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <Table
          size="small" rowKey="_id" loading={loading} dataSource={data.subAgents}
          locale={{ emptyText: 'No sub-agents yet' }}
          columns={[
            { title: 'Name', dataIndex: 'name' },
            { title: 'Email', dataIndex: 'email', render: (v) => v || '—' },
            { title: 'Phone', dataIndex: 'phone', render: (v) => v || '—' },
            { title: 'Status', dataIndex: 'isActive', render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> },
            { title: 'Leads', dataIndex: 'totalLeads', align: 'right' },
            { title: 'Approved', dataIndex: 'approvedLeads', align: 'right' },
            { title: 'Joined', dataIndex: 'createdAt', render: (v) => dayjs(v).format('D MMM YYYY') },
          ]}
          scroll={{ x: 'max-content' }}
        />
      </div>
      <Typography.Paragraph type="secondary" style={{ marginTop: 10, fontSize: 12 }}>
        Sub-agents are managed by MySilah admin. Customer contact details and sub-agent commissions are not visible to you.
      </Typography.Paragraph>
    </div>
  );
}
