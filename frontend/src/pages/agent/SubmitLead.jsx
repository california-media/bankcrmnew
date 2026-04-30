import { useEffect, useState } from 'react';
import { Card, Form, Input, Select, Button, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
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
      <Typography.Title level={3}>Submit New Lead</Typography.Title>
      <Card style={{ maxWidth: 600 }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="customerName" label="Customer name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone number" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="productType" label="Product type" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'credit_card', label: 'Credit Card' },
                { value: 'loan', label: 'Loan' },
              ]}
            />
          </Form.Item>
          <Form.Item name="bank" label="Bank" rules={[{ required: true }]}>
            <Select
              options={banks.map((b) => ({ value: b._id, label: b.name }))}
              placeholder="Select bank"
            />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            Submit Lead
          </Button>
        </Form>
      </Card>
    </>
  );
}

export default SubmitLead;
