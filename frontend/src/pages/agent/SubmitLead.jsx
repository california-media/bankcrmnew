import { useState } from 'react';
import { Card, Form, Input, Select, Button, Typography, Row, Col, message, Space, Alert } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';

function SubmitLead() {
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const onFinish = async (values) => {
    setSubmitting(true);
    try {
      await api.post('/leads', values);
      message.success('Draft saved. Open My Leads to send it to an agency.');
      navigate('/agent/leads');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Typography.Title level={3} style={{ margin: 0 }}>New Lead</Typography.Title>
          <Typography.Text type="secondary">
            Capture the customer's info. You'll pick the agency and bank from My Leads.
          </Typography.Text>
        </Col>
        <Col>
          <Link to="/agent/leads">
            <Button icon={<ArrowLeftOutlined />}>Back to leads</Button>
          </Link>
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        message="This lead is saved as a draft."
        description="From My Leads → Send to Agency, choose an agency and one of their banks. Banks are owned by agencies."
        style={{ margin: '16px 0 24px' }}
      />

      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Card title="Client Information" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="customerName" label="Client Full Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Mohammed Ahmed" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="phone" label="Mobile Number" rules={[{ required: true }]}>
                <Input placeholder="+971 50 xxx xxxx" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card title="Product" style={{ marginBottom: 16 }}>
          <Form.Item name="productType" label="Product Type" rules={[{ required: true }]}>
            <Select
              placeholder="Select a product"
              options={[
                { value: 'credit_card', label: 'Credit Card' },
                { value: 'loan', label: 'Loan' },
              ]}
            />
          </Form.Item>
          <Form.Item name="notes" label="Notes (optional)">
            <Input.TextArea rows={3} placeholder="Anything the agency should know about this customer." />
          </Form.Item>
        </Card>

        <Space>
          <Button type="primary" htmlType="submit" loading={submitting}>
            Save Draft
          </Button>
          <Button onClick={() => form.resetFields()}>Reset</Button>
        </Space>
      </Form>
    </>
  );
}

export default SubmitLead;
