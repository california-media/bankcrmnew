import { useEffect } from 'react';
import { Form, Input, Button, Alert } from 'antd';
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
    <div style={styles.shell}>
      <div style={styles.card}>
        <div className="eyebrow">§ New Field Correspondent</div>
        <h1 style={styles.title}>
          Register a <em style={styles.italic}>column</em>.
        </h1>
        <p style={styles.lede}>
          Agents file leads from the field. Sign up to receive a referral cipher and begin filing.
        </p>
        <hr className="rule" />

        {error && <Alert type="error" message={error} style={{ marginBottom: 16, borderRadius: 2 }} />}

        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <div style={styles.row}>
            <Form.Item name="name" label={<span className="eyebrow">Full Name</span>} rules={[{ required: true }]} style={{ flex: 1, marginBottom: 16 }}>
              <Input />
            </Form.Item>
            <Form.Item name="phone" label={<span className="eyebrow">Phone</span>} style={{ flex: 1, marginBottom: 16 }}>
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="email" label={<span className="eyebrow">Email Address</span>} rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <div style={styles.row}>
            <Form.Item name="password" label={<span className="eyebrow">Password</span>} rules={[{ required: true, min: 6 }]} style={{ flex: 1, marginBottom: 16 }}>
              <Input.Password />
            </Form.Item>
            <Form.Item name="referralCode" label={<span className="eyebrow">Referral Cipher (optional)</span>} style={{ flex: 1, marginBottom: 16 }}>
              <Input placeholder="e.g. A4F7B2C1" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }} />
            </Form.Item>
          </div>
          <Button type="primary" htmlType="submit" loading={status === 'loading'} block style={styles.cta}>
            File My Registration &rarr;
          </Button>
        </Form>

        <hr className="rule" />
        <p style={styles.subnav}>
          Already on the masthead? <Link to="/login" style={styles.link}>Sign in &rarr;</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  shell: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  card: {
    width: '100%',
    maxWidth: 620,
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
  italic: {
    fontStyle: 'italic',
    color: 'var(--accent)',
    fontVariationSettings: '"opsz" 144',
  },
  lede: {
    fontFamily: 'var(--font-display)',
    fontSize: 17,
    lineHeight: 1.5,
    color: 'var(--ink-soft)',
    margin: 0,
  },
  row: { display: 'flex', gap: 16 },
  cta: {
    height: 48,
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    background: 'var(--ink)',
    borderColor: 'var(--ink)',
  },
  subnav: { fontFamily: 'var(--font-display)', fontSize: 15, fontStyle: 'italic', color: 'var(--ink-soft)', margin: 0 },
  link: { color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: 3 },
};

export default Register;
