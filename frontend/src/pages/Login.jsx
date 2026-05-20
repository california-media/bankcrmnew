import { useEffect } from 'react';
import { Card, Form, Input, Button, Typography, Alert, Divider } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/slices/authSlice';

const DEMO_ACCOUNTS = [
  { label: 'Admin',        email: 'admin@gmail.com',    password: 'admin123' },
  { label: 'Agency',       email: 'agency@gmail.com',   password: '123456' },
  { label: 'Agent',        email: 'agent@gmail.com',    password: '123456' },
  { label: 'Employee (Sales)', email: 'employee@gmail.com',  password: '123456' },
  { label: 'Employee (CPV)',   email: 'employee2@gmail.com', password: '123456' },
];

function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, status, error } = useSelector((s) => s.auth);
  const [form] = Form.useForm();

  useEffect(() => {
    if (user) navigate(`/${user.role}`, { replace: true });
  }, [user, navigate]);

  useEffect(() => () => dispatch(clearError()), [dispatch]);

  const onFinish = (values) => dispatch(login(values));

  const fillDemo = ({ email, password }) => {
    form.setFieldsValue({ email, password });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 420 }}>
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 4 }}>Bank Portal</Typography.Title>
        <Typography.Paragraph style={{ textAlign: 'center', color: '#888' }}>Sign in to your account</Typography.Paragraph>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input placeholder="you@example.com" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={status === 'loading'} block>
            Login
          </Button>
        </Form>
        <Typography.Paragraph style={{ textAlign: 'center', marginTop: 16, marginBottom: 0 }}>
          New agent? <Link to="/register">Create an account</Link>
        </Typography.Paragraph>

        <Divider style={{ fontSize: 12, color: '#bbb' }}>Demo Accounts</Divider>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {DEMO_ACCOUNTS.map((acc) => (
            <Button
              key={acc.email}
              size="small"
              onClick={() => fillDemo(acc)}
              style={{ fontSize: 12, borderStyle: 'dashed' }}
            >
              {acc.label}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default Login;
