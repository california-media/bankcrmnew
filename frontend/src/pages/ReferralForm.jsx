import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Form, Input, InputNumber, Select, Button, Typography, Alert, Result, Row, Col, Spin } from 'antd';
import { SendOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const NATIONALITIES = [
  'UAE', 'Saudi Arabia', 'Kuwait', 'Qatar', 'Bahrain', 'Oman',
  'Egypt', 'Jordan', 'Lebanon', 'Syria', 'Iraq', 'Yemen',
  'India', 'Pakistan', 'Bangladesh', 'Philippines', 'Sri Lanka',
  'United Kingdom', 'United States', 'Canada', 'Australia',
  'Germany', 'France', 'Italy', 'Spain', 'Netherlands',
  'China', 'Japan', 'South Korea', 'Indonesia', 'Malaysia',
  'Nigeria', 'Kenya', 'South Africa', 'Other',
];

const VISA_TYPES = [
  'UAE Resident',
  'Employment Visa',
  'Investor Visa',
  'Free Zone Visa',
  'Family Visa',
  'Golden Visa',
  'Tourist Visa',
  'Other',
];

export default function ReferralForm() {
  const { code } = useParams();
  const [form] = Form.useForm();
  const [agentName, setAgentName] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE}/public/ref/${code}`)
      .then((res) => setAgentName(res.data.agentName))
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false));
  }, [code]);

  const onFinish = async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      await axios.post(`${API_BASE}/public/ref/${code}/submit`, values);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
        <Card style={{ width: 460, textAlign: 'center' }}>
          <Result status="404" title="Invalid Link" subTitle="This referral link is not valid or has expired." />
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
        <Card style={{ width: 480, textAlign: 'center' }}>
          <Result
            status="success"
            title="Application Submitted!"
            subTitle="Thank you! Your details have been received. Our team will be in touch with you shortly."
            extra={
              <Button icon={<ReloadOutlined />} onClick={() => { setSubmitted(false); form.resetFields(); }}>
                Submit Another
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: '32px 16px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
      <Card style={{ width: '100%', maxWidth: 640, borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <Typography.Title level={3} style={{ margin: '0 0 4px', fontWeight: 700 }}>New Lead</Typography.Title>
        {agentName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              Referred by <strong>{agentName}</strong>
            </Typography.Text>
            <span style={{
              background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe',
              borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700,
              letterSpacing: 1.5, fontFamily: 'monospace',
            }}>
              {code}
            </span>
          </div>
        )}

        <div style={{ marginTop: 20, marginBottom: 8, padding: '12px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <Typography.Text style={{ fontWeight: 600, fontSize: 14 }}>Client Information</Typography.Text>
        </div>

        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} showIcon />}

        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="customerName" label="Full Name" rules={[{ required: true, message: 'Full name required' }]}>
                <Input placeholder="Mohammed Ahmed" size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="phone" label="Mobile Number" rules={[{ required: true, message: 'Mobile number required' }]}>
                <Input placeholder="+971 50 xxx xxxx" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="email" label="Email">
                <Input placeholder="client@email.com" size="large" type="email" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="nationality" label="Nationality">
                <Select placeholder="Select" size="large" showSearch optionFilterProp="label"
                  options={NATIONALITIES.map((n) => ({ value: n, label: n }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="visaType" label="Visa Type">
                <Select placeholder="Select" size="large"
                  options={VISA_TYPES.map((v) => ({ value: v, label: v }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="companyName" label="Company">
                <Input placeholder="Your company" size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="jobTitle" label="Job Title">
                <Input placeholder="Sales Manager" size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="yearsOfExperience" label="Experience (yrs)">
                <InputNumber min={0} max={50} placeholder="0" size="large" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Anything the agency should know about this client." />
          </Form.Item>

          <div style={{ display: 'flex', gap: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              icon={<SendOutlined />}
              size="large"
              style={{ flex: 1, background: '#4f46e5', borderColor: '#4f46e5', fontWeight: 600 }}
            >
              Submit Lead
            </Button>
            <Button size="large" onClick={() => form.resetFields()}>Reset</Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}
