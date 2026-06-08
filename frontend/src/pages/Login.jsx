import { useEffect } from 'react';
import { Form, Input, Button, Alert } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/slices/authSlice';

const DEMO_ACCOUNTS = [
  { label: 'Administrator', email: 'admin@gmail.com',     password: 'admin123' },
  { label: 'Agency',        email: 'agency@gmail.com',    password: '123456' },
  { label: 'Agent',         email: 'agent@gmail.com',     password: '123456' },
  { label: 'Employee',      email: 'employee@gmail.com',  password: '123456' },
];

const PRODUCT_TAGS = ['Credit Cards', 'Personal Loans', 'SME Loans', 'Financial Products'];

const PILLARS = [
  { num: '01', role: 'AGENT', headline: 'Earn transparently' },
  { num: '02', role: 'AGENCY', headline: 'Grow faster' },
  { num: '03', role: 'BANK', headline: 'Real results' },
];

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:8000';

function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, status, error } = useSelector((s) => s.auth);
  const [form] = Form.useForm();

  const handleUaePass = () => { window.location.href = `${API_BASE}/api/auth/uaepass/init`; };

  useEffect(() => {
    if (user) navigate(`/${user.role}`, { replace: true });
  }, [user, navigate]);

  useEffect(() => () => dispatch(clearError()), [dispatch]);

  const onFinish = (values) => dispatch(login(values));

  const fillDemo = ({ email, password }) => {
    form.setFieldsValue({ email, password });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      background: 'linear-gradient(135deg, #eef2ff 0%, #f0f4ff 40%, #e8f0fe 100%)',
    }}>

      {/* LEFT — brand + marketing */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '40px 56px',
      }}>
        {/* Logo */}
        <div>
          <img src="/logo.png" alt="Bank CRM" style={{ height: 44, width: 'auto', objectFit: 'contain' }} />
        </div>

        {/* Hero */}
        <div style={{ maxWidth: 520 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            border: '1px solid #c7d2fe', borderRadius: 999,
            padding: '6px 16px', fontSize: 11, color: '#6366f1',
            fontWeight: 700, marginBottom: 32, background: 'rgba(255,255,255,0.6)',
            letterSpacing: 1.2, textTransform: 'uppercase',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
            UAE Banking Referral Infrastructure
          </div>

          <h1 style={{
            fontSize: 44, fontWeight: 800, lineHeight: 1.12,
            color: '#0f172a', margin: '0 0 8px', letterSpacing: -0.5,
          }}>
            Earn Transparently.
          </h1>
          <h1 style={{
            fontSize: 44, fontWeight: 800, lineHeight: 1.12,
            color: '#6366f1', margin: '0 0 24px', letterSpacing: -0.5,
          }}>
            Submit a Lead. Get Paid.
          </h1>

          <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.7, margin: '0 0 28px' }}>
            Create and manage referrals with real-time tracking, transparent
            commissions, and a secure onboarding experience.
          </p>

          {/* Product tags */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
            {PRODUCT_TAGS.map((tag) => (
              <div key={tag} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 999,
                border: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.7)',
                fontSize: 13, fontWeight: 500, color: '#374151',
              }}>
                {tag === 'Credit Cards' && '💳'}
                {tag === 'Personal Loans' && '🛡'}
                {tag === 'SME Loans' && '🏢'}
                {tag === 'Financial Products' && '📈'}
                {tag}
              </div>
            ))}
          </div>

          {/* Pillars */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            borderRadius: 14, overflow: 'hidden',
            border: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.6)',
          }}>
            {PILLARS.map((p, i) => (
              <div key={p.num} style={{
                padding: '16px 18px',
                borderLeft: i > 0 ? '1px solid #e2e8f0' : 'none',
              }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>
                  {p.num} / {p.role}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{p.headline}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          © 2026 Inizio Global · Built for Growth. Driven by Trust.
        </div>
      </div>

      {/* RIGHT — login form */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 56px',
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(12px)',
        borderLeft: '1px solid rgba(255,255,255,0.7)',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
            Welcome back
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 32px' }}>
            Sign in to your referral workspace.
          </p>

          {error && (
            <Alert type="error" message={error} style={{ marginBottom: 20, borderRadius: 8 }} />
          )}

          <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item
              name="email"
              label={<span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Work email</span>}
              rules={[{ required: true, type: 'email', message: 'Valid email required' }]}
              style={{ marginBottom: 16 }}
            >
              <Input
                size="large"
                placeholder="you@company.ae"
                style={{ borderRadius: 10, fontSize: 14 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Password</span>}
              rules={[{ required: true, message: 'Password required' }]}
              style={{ marginBottom: 24 }}
            >
              <Input.Password
                size="large"
                style={{ borderRadius: 10, fontSize: 14 }}
              />
            </Form.Item>

            {/* Demo role picker */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                Sign in as (demo)
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillDemo(acc)}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: '1.5px solid #e2e8f0',
                      background: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#374151',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, color 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#374151'; }}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              loading={status === 'loading'}
              block
              size="large"
              style={{
                borderRadius: 10,
                height: 48,
                fontSize: 15,
                fontWeight: 700,
                background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                border: 'none',
                boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
                marginBottom: 16,
              }}
            >
              Continue to dashboard
            </Button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 14px' }}>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
              <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>or sign in with</span>
              <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            </div>

            <button
              type="button"
              onClick={handleUaePass}
              style={{
                width: '100%',
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                background: '#fff',
                border: '1.5px solid #d1d5db',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 15,
                fontWeight: 600,
                color: '#0f172a',
                letterSpacing: 0.1,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            >
              <img
                src="https://www.uaepass.ae/content/dam/uae-pass/images/logo/uae-pass-logo.svg"
                alt="UAE PASS"
                style={{ height: 22 }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              Sign in with UAE PASS
            </button>
          </Form>

          <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', margin: 0, lineHeight: 1.6 }}>
            New agent?{' '}
            <Link to="/register" style={{ color: '#6366f1', textDecoration: 'underline' }}>Create an account</Link>
            {' '}· By signing in you agree to Bank CRM's Terms.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
