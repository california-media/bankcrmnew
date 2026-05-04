import { useEffect, useState } from 'react';
import { Card, Form, Input, Select, Button, Typography, Row, Col, message, Space, Empty } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';

function SubmitLead() {
  const [banks, setBanks] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [agenciesLoading, setAgenciesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const selectedBank = Form.useWatch('bank', form);

  useEffect(() => {
    api.get('/banks').then((res) => setBanks(res.data));
  }, []);

  useEffect(() => {
    if (!selectedBank) {
      setAgencies([]);
      form.setFieldValue('agency', undefined);
      return;
    }
    setAgenciesLoading(true);
    api.get(`/agencies/for-bank/${selectedBank}`)
      .then((res) => {
        setAgencies(res.data);
        const current = form.getFieldValue('agency');
        if (current && !res.data.some((a) => a._id === current)) {
          form.setFieldValue('agency', undefined);
        }
      })
      .finally(() => setAgenciesLoading(false));
  }, [selectedBank, form]);

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
            Pick the bank, then the agency that will handle this lead.
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
          <Form.Item
            name="agency"
            label="Send to Agency"
            rules={[{ required: true, message: 'Pick the agency that should handle this lead' }]}
            extra={selectedBank
              ? (agencies.length === 0 && !agenciesLoading
                ? 'No active agency services this bank yet — ask the admin to assign one.'
                : 'Only agencies that service the chosen bank are listed.')
              : 'Choose a bank first.'}
          >
            <Select
              loading={agenciesLoading}
              disabled={!selectedBank}
              placeholder={selectedBank ? 'Pick an agency' : 'Select a bank first'}
              notFoundContent={selectedBank ? <Empty description="No agencies for this bank" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : null}
              options={agencies.map((a) => ({ value: a._id, label: a.name || a.email }))}
            />
          </Form.Item>
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
