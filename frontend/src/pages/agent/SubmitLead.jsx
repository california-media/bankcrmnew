import { useEffect, useState } from 'react';
import { Card, Form, Input, Select, Button, Typography, Row, Col, message, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';

function SubmitLead() {
  const [banks, setBanks] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  useEffect(() => {
    api.get('/banks').then((res) => setBanks(res.data));
  }, []);

  const onFinish = async (values) => {
    setSubmitting(true);
    try {
      await api.post('/leads', values);
      message.success('Lead submitted');
      navigate('/agent/leads');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Typography.Title level={3} style={{ margin: 0 }}>Submit New Lead</Typography.Title>
          <Typography.Text type="secondary">
            Enter your client's details and we'll route them to the right agency.
          </Typography.Text>
        </Col>
        <Col>
          <Link to="/agent/leads">
            <Button icon={<ArrowLeftOutlined />}>Back to leads</Button>
          </Link>
        </Col>
      </Row>

      <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 24 }}>
        <Card title="Client Information" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="customerName"
                label="Client Full Name"
                rules={[{ required: true }]}
              >
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

        <Card title="Product Details" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="productType" label="Product Type" rules={[{ required: true }]}>
                <Select
                  placeholder="Select a product"
                  options={[
                    { value: 'credit_card', label: 'Credit Card' },
                    { value: 'loan', label: 'Loan' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="bank" label="Bank" rules={[{ required: true }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select bank"
                  options={banks.map((b) => ({ value: b._id, label: b.name }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes (optional)">
            <Input.TextArea rows={3} placeholder="Anything the agency should know about this customer." />
          </Form.Item>
        </Card>

        <Space>
          <Button type="primary" htmlType="submit" loading={submitting}>
            Submit Lead
          </Button>
          <Button onClick={() => form.resetFields()}>Reset</Button>
        </Space>
      </Form>
    </>
  );
}

export default SubmitLead;
