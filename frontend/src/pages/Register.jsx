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

  // Handle prefill from UAE Pass (when email wasn't in UAE Pass profile)
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
      } catch { /* invalid token — ignore */ }
    }

    const errCode = searchParams.get('uaepass_error');
    if (errCode) {
      setUaepassError(UAE_PASS_ERROR_MESSAGES[errCode] || 'UAE Pass authentication failed.');
    }
  }, [searchParams]);

  const onFinish = (values) => {
    const payload = {
      name:         values.name,
      email:        values.email,
      password:     values.password,
      phone:        values.phone,
      referralCode: values.referralCode,
      emiratesId:   values.emiratesId,
    };
    if (values._uaepassSub) payload.uaepassSub = values._uaepassSub;
    dispatch(registerAgent(payload));
  };

  const handleUaePass = () => {
    window.location.href = `${API_BASE}/api/auth/uaepass/init`;
  };

  const isPrefilled = !!searchParams.get('uaepass_prefill');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 460 }}>
        <Typography.Title level={4} style={{ textAlign: 'center', marginBottom: 4, fontWeight: 500 }}>Agent Registration</Typography.Title>
        <Typography.Paragraph style={{ textAlign: 'center', color: '#888', marginBottom: 20 }}>Sign up to submit leads and earn commissions</Typography.Paragraph>

        {uaepassError && <Alert type="error" message={uaepassError} style={{ marginBottom: 16 }} closable onClose={() => setUaepassError(null)} />}
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}

        {isPrefilled && (
          <Alert
            type="success"
            message="UAE Pass verified — complete your registration below"
            style={{ marginBottom: 16 }}
            showIcon
          />
        )}

        {/* UAE Pass button */}
        {!isPrefilled && (
          <>
            <Button
              block
              size="large"
              onClick={handleUaePass}
              style={{
                height: 48,
                border: '1.5px solid #009e60',
                borderRadius: 10,
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                fontWeight: 600,
                color: '#009e60',
                fontSize: 15,
                marginBottom: 4,
              }}
            >
              <img
                src="https://www.uaepass.ae/content/dam/uae-pass/images/logo/uae-pass-logo.svg"
                alt="UAE Pass"
                style={{ height: 22 }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              Register with UAE Pass
            </Button>
            <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', fontSize: 12, marginBottom: 8 }}>
              Instant verification using your Emirates ID
            </Typography.Text>
            <Divider style={{ margin: '16px 0' }}>or register manually</Divider>
          </>
        )}

        <Form form={form} layout="vertical" onFinish={onFinish}>
          {/* Hidden UAE Pass fields */}
          <Form.Item name="_uaepassSub" hidden><Input /></Form.Item>
          <Form.Item name="_uaepassPrefill" hidden><Input /></Form.Item>

          <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input placeholder="+971 50 xxx xxxx" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="referralCode" label="Referral Code (optional)">
            <Input placeholder="From an existing agent" />
          </Form.Item>
          <Form.Item name="emiratesId" label="Emirates ID (optional)">
            <Input placeholder="784-XXXX-XXXXXXX-X" />
          </Form.Item>
          <Form.Item
            name="agreeToTerms"
            valuePropName="checked"
            rules={[{ validator: (_, v) => v ? Promise.resolve() : Promise.reject('You must accept the Terms and Conditions') }]}
          >
            <Checkbox>I agree to the <Link to="/terms" target="_blank">Terms and Conditions</Link></Checkbox>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={status === 'loading'} block>
            {isPrefilled ? 'Complete Registration' : 'Register'}
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
