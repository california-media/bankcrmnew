import { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert, Checkbox, Divider } from 'antd';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { registerAgent, clearError } from '../store/slices/authSlice';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000';

const UAE_PASS_ERROR_MESSAGES = {
  invalid_state:   'Session expired. Please try again.',
  token_failed:    'UAE Pass authentication failed. Please try again.',
  userinfo_failed: 'Could not retrieve your UAE Pass profile. Please try again.',
  server_error:    'Something went wrong. Please try again.',
  access_denied:   'UAE Pass access was denied.',
};

function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, status, error } = useSelector((s) => s.auth);
  const [form] = Form.useForm();
  const [uaepassError, setUaepassError] = useState(null);

  useEffect(() => {
    if (user) navigate(`/${user.role}`, { replace: true });
  }, [user, navigate]);

  useEffect(() => () => dispatch(clearError()), [dispatch]);

  useEffect(() => {
    const prefill = searchParams.get('uaepass_prefill');
    if (prefill) {
      try {
        const payload = JSON.parse(atob(prefill.split('.')[1]));
        form.setFieldsValue({
          name:       payload.name       || '',
          phone:      payload.phone      || '',
          emiratesId: payload.emiratesId || '',
          _uaepassSub:  payload.sub      || '',
          _uaepassPrefill: prefill,
        });
      } catch { /* ignore */ }
    }
    const errCode = searchParams.get('uaepass_error');
    if (errCode) setUaepassError(UAE_PASS_ERROR_MESSAGES[errCode] || 'UAE Pass authentication failed.');
  }, [searchParams]);

  const onFinish = (values) => {
    const payload = {
      name:         values.name,
      email:        values.email,
      password:     values.password,
      phone:        values.phone,
      emiratesId:   values.emiratesId,
    };
    if (values._uaepassSub) payload.uaepassSub = values._uaepassSub;
    dispatch(registerAgent(payload));
  };

  const handleUaePass = () => { window.location.href = `${API_BASE}/api/auth/uaepass/init`; };
  const isPrefilled = !!searchParams.get('uaepass_prefill');
  const itemStyle = { marginBottom: 10 };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5', padding: '16px 0' }}>
      <Card style={{ width: 460 }} styles={{ body: { padding: '20px 24px' } }}>
        <Typography.Title level={4} style={{ textAlign: 'center', marginBottom: 2, fontWeight: 600 }}>
          Agent Registration
        </Typography.Title>
        <Typography.Paragraph style={{ textAlign: 'center', color: '#888', marginBottom: 12, fontSize: 13 }}>
          Sign up to submit leads and earn commissions
        </Typography.Paragraph>

        {uaepassError && <Alert type="error" message={uaepassError} style={{ marginBottom: 10 }} closable onClose={() => setUaepassError(null)} />}
        {error && <Alert type="error" message={error} style={{ marginBottom: 10 }} />}

        {isPrefilled && (
          <Alert type="success" message="UAE Pass verified — complete your registration below" style={{ marginBottom: 10 }} showIcon />
        )}
        {!isPrefilled && (
          <>
            <Button
              block onClick={handleUaePass}
              style={{ height: 40, border: '1.5px solid #009e60', borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 600, color: '#009e60', fontSize: 14, marginBottom: 2 }}
            >
              <img src="https://www.uaepass.ae/content/dam/uae-pass/images/logo/uae-pass-logo.svg" alt="UAE Pass" style={{ height: 18 }} onError={(e) => { e.target.style.display = 'none'; }} />
              Register with UAE Pass
            </Button>
            <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: 11, marginBottom: 4 }}>
              Instant verification using your Emirates ID
            </Typography.Text>
            <Divider style={{ margin: '10px 0' }}>or register manually</Divider>
          </>
        )}

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="_uaepassSub" hidden><Input /></Form.Item>
          <Form.Item name="_uaepassPrefill" hidden><Input /></Form.Item>
          <Form.Item name="name" rules={[{ required: true, message: 'Name required' }]} style={itemStyle}>
            <Input placeholder="Full Name *" />
          </Form.Item>
          <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Valid email required' }]} style={itemStyle}>
            <Input placeholder="Email *" />
          </Form.Item>
          <Form.Item name="phone" style={itemStyle}>
            <Input placeholder="Phone (+971 50 xxx xxxx)" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, min: 6, message: 'Min 6 characters' }]} style={itemStyle}>
            <Input.Password placeholder="Password *" />
          </Form.Item>
          <Form.Item name="emiratesId" style={itemStyle}>
            <Input placeholder="Emirates ID (optional) — 784-XXXX-XXXXXXX-X" />
          </Form.Item>
          <Form.Item
            name="agreeToTerms" valuePropName="checked" style={itemStyle}
            rules={[{ validator: (_, v) => v ? Promise.resolve() : Promise.reject('You must accept the Terms and Conditions') }]}
          >
            <Checkbox>I agree to the <Link to="/terms" target="_blank">Terms and Conditions</Link></Checkbox>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={status === 'loading'} block>
            {isPrefilled ? 'Complete Registration' : 'Register'}
          </Button>
        </Form>

        <Typography.Paragraph style={{ textAlign: 'center', marginTop: 12, marginBottom: 0, fontSize: 13 }}>
          Already have an account? <Link to="/login">Login</Link>
          {' · '}
          <Link to="/register/agency">Register as Agency</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}

export default Register;
