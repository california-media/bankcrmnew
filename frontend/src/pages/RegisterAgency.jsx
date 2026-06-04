import { useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert, Checkbox, Result, Select } from 'antd';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { registerAgency, clearError } from '../store/slices/authSlice';

function RegisterAgency() {
  const dispatch = useDispatch();
  const { status, error } = useSelector((s) => s.auth);
  const [form] = Form.useForm();
  const [submitted, setSubmitted] = useState(false);

  const onFinish = async (values) => {
    const result = await dispatch(registerAgency({
      name:         values.name,
      companyName:  values.companyName,
      tradeLicense: values.tradeLicense,
      email:        values.email,
      phone:        values.phone,
      password:     values.password,
      emiratesId:   values.emiratesId,
      city:         values.city,
    }));
    if (!result.error) setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
        <Card style={{ width: 480, textAlign: 'center' }}>
          <Result
            status="success"
            title="Registration Submitted!"
            subTitle="Your agency registration is pending admin approval. You'll be able to login once approved."
            extra={<Link to="/login"><Button type="primary">Go to Login</Button></Link>}
          />
        </Card>
      </div>
    );
  }

  const itemStyle = { marginBottom: 10 };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5', padding: '16px 0' }}>
      <Card style={{ width: 460 }} styles={{ body: { padding: '20px 24px' } }}>
        <Typography.Title level={4} style={{ textAlign: 'center', marginBottom: 2, fontWeight: 600 }}>
          Agency Registration
        </Typography.Title>
        <Typography.Paragraph style={{ textAlign: 'center', color: '#888', marginBottom: 16, fontSize: 13 }}>
          Register your agency — admin will review and approve
        </Typography.Paragraph>

        {error && <Alert type="error" message={error} style={{ marginBottom: 10 }} onClose={() => dispatch(clearError())} closable />}

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" rules={[{ required: true, message: 'Full name required' }]} style={itemStyle}>
            <Input placeholder="Full Name *" />
          </Form.Item>
          <Form.Item name="phone" rules={[{ required: true, message: 'Phone required' }]} style={itemStyle}>
            <Input placeholder="Phone Number * (+971 50 xxx xxxx)" />
          </Form.Item>
          <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Valid email required' }]} style={itemStyle}>
            <Input placeholder="Email *" />
          </Form.Item>
          <Form.Item name="companyName" rules={[{ required: true, message: 'Company name required' }]} style={itemStyle}>
            <Input placeholder="Company Name *" />
          </Form.Item>
          <Form.Item name="tradeLicense" rules={[{ required: true, message: 'Trade license required' }]} style={itemStyle}>
            <Input placeholder="Trade License Number * (e.g. CN-123456)" />
          </Form.Item>
          <Form.Item name="emiratesId" style={itemStyle}>
            <Input placeholder="Emirates ID — 784-XXXX-XXXXXXX-X" />
          </Form.Item>
          <Form.Item name="city" rules={[{ required: true, message: 'City required' }]} style={itemStyle}>
            <Select placeholder="City *">
              <Select.Option value="Abu Dhabi">Abu Dhabi</Select.Option>
              <Select.Option value="Dubai">Dubai</Select.Option>
              <Select.Option value="Sharjah">Sharjah</Select.Option>
              <Select.Option value="Ajman">Ajman</Select.Option>
              <Select.Option value="Umm Al Quwain">Umm Al Quwain</Select.Option>
              <Select.Option value="Ras Al Khaimah">Ras Al Khaimah</Select.Option>
              <Select.Option value="Fujairah">Fujairah</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, min: 6, message: 'Min 6 characters' }]} style={itemStyle}>
            <Input.Password placeholder="Password *" />
          </Form.Item>
          <Form.Item
            name="agreeToTerms" valuePropName="checked" style={itemStyle}
            rules={[{ validator: (_, v) => v ? Promise.resolve() : Promise.reject('You must accept the Terms and Conditions') }]}
          >
            <Checkbox>I agree to the <Link to="/terms" target="_blank">Terms and Conditions</Link></Checkbox>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={status === 'loading'} block>
            Submit for Approval
          </Button>
        </Form>

        <Typography.Paragraph style={{ textAlign: 'center', marginTop: 12, marginBottom: 0, fontSize: 13 }}>
          Already have an account? <Link to="/login">Login</Link>
          {' · '}
          <Link to="/register">Register as Agent</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}

export default RegisterAgency;
