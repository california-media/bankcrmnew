import { useEffect, useState } from 'react';
import { Form, Input, Button, Alert, Spin } from 'antd';
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
    api.get(`/auth/invite/${token}`)
      .then((res) => setInvite(res.data))
      .catch((err) => setVerifyError(err.response?.data?.message || 'Invalid invite'))
      .finally(() => setVerifying(false));
  }, [token]);

  useEffect(() => { if (user) navigate(`/${user.role}`, { replace: true }); }, [user, navigate]);
  useEffect(() => () => dispatch(clearError()), [dispatch]);

  const onFinish = (values) => dispatch(setPassword({ token, ...values }));

  if (verifying) {
    return <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Spin size="large" /></div>;
  }

  return (
    <div style={styles.shell}>
      <div style={styles.card}>
        <div className="eyebrow">§ Account Activation</div>
        <h1 style={styles.title}>
          Set the <em style={styles.italic}>seal.</em>
        </h1>

        {invite && (
          <p style={styles.lede}>
            Activating <span style={{ fontFamily: 'var(--font-mono)', background: 'var(--paper)', padding: '2px 6px' }}>{invite.email}</span> as <i>{invite.role}</i>. Choose a password to take possession.
          </p>
        )}

        <hr className="rule" />

        {(verifyError || error) && (
          <Alert type="error" message={verifyError || error} style={{ marginBottom: 16, borderRadius: 2 }} />
        )}

        {invite && (
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item name="name" label={<span className="eyebrow">Full Name / Agency</span>} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="phone" label={<span className="eyebrow">Phone</span>}>
              <Input />
            </Form.Item>
            <Form.Item name="password" label={<span className="eyebrow">Password</span>} rules={[{ required: true, min: 6 }]}>
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={status === 'loading'} block style={styles.cta}>
              Activate &amp; Sign In &rarr;
            </Button>
          </Form>
        )}
      </div>
    </div>
  );
}

const styles = {
  shell: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' },
  card: {
    width: '100%',
    maxWidth: 540,
    background: 'var(--surface)',
    border: '1px solid var(--rule)',
    boxShadow: 'var(--shadow-paper)',
    padding: '48px 56px',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: 56,
    lineHeight: 1,
    letterSpacing: '-0.03em',
    fontWeight: 400,
    margin: '12px 0 12px',
    color: 'var(--ink)',
  },
  italic: { fontStyle: 'italic', color: 'var(--accent)' },
  lede: { fontFamily: 'var(--font-display)', fontSize: 17, lineHeight: 1.5, color: 'var(--ink-soft)', margin: 0 },
  cta: {
    height: 48,
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    background: 'var(--ink)',
    borderColor: 'var(--ink)',
  },
};

export default SetPassword;
