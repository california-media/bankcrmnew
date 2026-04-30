import { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert, Spin } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import api from '../api/client';
import { setPassword, clearError } from '../store/slices/authSlice';

function SetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, status, error } = useSelector((s) => s.auth);

  const [verifying, setVerifying] = useState(true);
  const [invite, setInvite] = useState(null);
  const [verifyError, setVerifyError] = useState(null);

  useEffect(() => {
    if (!token) { setVerifying(false); setVerifyError('Missing token'); return; }
    api
      .get(`/auth/invite/${token}`)
      .then((res) => setInvite(res.data))
      .catch((err) => setVerifyError(err.response?.data?.message || 'Invalid invite'))
      .finally(() => setVerifying(false));
  }, [token]);

  useEffect(() => {
    if (user) navigate(`/${user.role}`, { replace: true });
  }, [user, navigate]);

  useEffect(() => () => dispatch(clearError()), [dispatch]);

  const onFinish = (values) => dispatch(setPassword({ token, ...values }));

  if (verifying) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 440 }}>
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 4 }}>Activate Account</Typography.Title>
        {invite && (
          <Typography.Paragraph style={{ textAlign: 'center', color: '#888' }}>
            Setting up <b>{invite.email}</b> ({invite.role})
          </Typography.Paragraph>
        )}
        {(verifyError || error) && <Alert type="error" message={verifyError || error} style={{ marginBottom: 16 }} />}
        {invite && (
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item name="name" label="Full name / Agency name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="Phone">
              <Input />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={status === 'loading'} block>
              Activate &amp; Login
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
}

export default SetPassword;
