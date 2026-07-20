import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin, Typography } from 'antd';

function UaePassCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      navigate('/register', { replace: true });
      return;
    }
    try {
      localStorage.setItem('token', token);
      const payload = JSON.parse(atob(token.split('.')[1]));
      navigate(`/${payload.role}`, { replace: true });
    } catch {
      navigate('/login', { replace: true });
    }
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <Spin size="large" />
      <Typography.Text type="secondary">Completing UAE Pass sign-in…</Typography.Text>
    </div>
  );
}

export default UaePassCallback;
