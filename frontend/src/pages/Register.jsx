import { useEffect } from 'react';
import { Card, Form, Input, Button, Typography, Alert, Checkbox } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { registerAgent, clearError } from '../store/slices/authSlice';

function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, status, error } = useSelector((s) => s.auth);

  useEffect(() => {
    if (user) navigate(`/${user.role}`, { replace: true });
  }, [user, navigate]);

  useEffect(() => () => dispatch(clearError()), [dispatch]);

  const onFinish = (values) => dispatch(registerAgent(values));

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 440 }}>
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 4 }}>Agent Registration</Typography.Title>
        <Typography.Paragraph style={{ textAlign: 'center', color: '#888' }}>Sign up as an agent</Typography.Paragraph>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" label="Full name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="referralCode" label="Referral code (optional)">
            <Input placeholder="From an existing agent" />
          </Form.Item>
          <Form.Item name="emiratesId" label="Emirates ID (optional)">
            <Input placeholder="e.g. 784-XXXX-XXXXXXX-X" />
          </Form.Item>
          <Form.Item
            name="agreeToTerms"
            valuePropName="checked"
            rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject('You must accept the Terms and Conditions') }]}
          >
            <Checkbox>
              I agree to the <Link to="/terms" target="_blank">Terms and Conditions</Link>
            </Checkbox>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={status === 'loading'} block>
            Register
          </Button>
        </Form>
        <Typography.Paragraph style={{ textAlign: 'center', marginTop: 16, marginBottom: 0 }}>
          Already have an account? <Link to="/login">Login</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}

export default Register;
