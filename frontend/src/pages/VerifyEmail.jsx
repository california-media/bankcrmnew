import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Spin, Card, Typography, Alert } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { verifyEmail } from '../store/slices/authSlice';

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, status, error } = useSelector((s) => s.auth);
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      dispatch(verifyEmail(token));
    }
  }, [token, dispatch]);

  useEffect(() => {
    if (user) {
      setTimeout(() => navigate(`/${user.role}`, { replace: true }), 1500);
    }
  }, [user, navigate]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 420, textAlign: 'center' }} styles={{ body: { padding: '48px 32px' } }}>
        {!token && (
          <Alert type="error" message="Invalid verification link." />
        )}
        {token && status === 'loading' && (
          <>
            <Spin size="large" />
            <Typography.Paragraph style={{ marginTop: 20, color: '#64748b' }}>
              Verifying your email...
            </Typography.Paragraph>
          </>
        )}
        {user && (
          <>
            <CheckCircleOutlined style={{ fontSize: 56, color: '#16a34a', marginBottom: 16 }} />
            <Typography.Title level={4} style={{ margin: '0 0 8px' }}>Email verified!</Typography.Title>
            <Typography.Paragraph style={{ color: '#64748b', margin: 0 }}>
              Redirecting you to your dashboard...
            </Typography.Paragraph>
          </>
        )}
        {error && (
          <>
            <CloseCircleOutlined style={{ fontSize: 56, color: '#dc2626', marginBottom: 16 }} />
            <Typography.Title level={4} style={{ margin: '0 0 8px' }}>Verification failed</Typography.Title>
            <Typography.Paragraph style={{ color: '#64748b', margin: 0 }}>
              {error} The link may have expired. Please register again.
            </Typography.Paragraph>
          </>
        )}
      </Card>
    </div>
  );
}

export default VerifyEmail;
