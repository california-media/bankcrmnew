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
  {
    num: '01', role: 'AGENT', headline: 'Earn transparently',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    num: '02', role: 'AGENCY', headline: 'Grow faster',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
  {
    num: '03', role: 'BANK', headline: 'Real results',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
      </svg>
    ),
  },
];

const FEATURES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: 'Live pipeline',
    sub: 'New → Paid in one view',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
    title: 'Product payouts',
    sub: 'Live commission ledger',
  },
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
  const fillDemo = ({ email, password }) => form.setFieldsValue({ email, password });

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
    }}>

      {/* LEFT — brand + marketing */}
      <div style={{
        background: 'linear-gradient(160deg, oklch(97% .02 275) 0%, oklch(96% .03 278) 40%, oklch(97% .02 283) 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '44px 52px',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 320, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: 80, left: -60,
          width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ zIndex: 1 }}>
          <img src="/logo.png" alt="Bank CRM" style={{ height: 44, width: 'auto', objectFit: 'contain' }} />
        </div>

        {/* Hero */}
        <div style={{ maxWidth: 520, zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            border: '1px solid rgba(139,92,246,0.35)', borderRadius: 999,
            padding: '6px 16px', fontSize: 11, color: '#7c3aed',
            fontWeight: 700, marginBottom: 32,
            background: 'rgba(255,255,255,0.65)',
            letterSpacing: 0.8, backdropFilter: 'blur(6px)',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#7c3aed" stroke="none">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            UAE Banking Referral Infrastructure
          </div>

          <h1 style={{
            fontSize: 34, fontWeight: 600, lineHeight: 1.12,
            color: '#1e1b4b', margin: '0 0 8px', letterSpacing: -0.5,
          }}>
            Earn Transparently.
          </h1>
          <h1 style={{
            fontSize: 34, fontWeight: 600, lineHeight: 1.12,
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: '0 0 24px', letterSpacing: -0.5,
          }}>
            Submit a Lead. Get Paid.
          </h1>

          <p style={{ fontSize: 15, color: '#4c4980', lineHeight: 1.7, margin: '0 0 28px' }}>
            Create and manage referrals with real-time tracking, transparent
            commissions, and a secure onboarding experience.
          </p>

          {/* Pillars */}
          <div style={{ display: 'flex', gap: 12 }}>
            {PILLARS.map((p) => (
              <div key={p.num} style={{
                flex: 1,
                background: 'rgba(255,255,255,0.82)',
                borderRadius: 18,
                padding: '20px 18px 18px',
                boxShadow: '0 2px 16px rgba(99,102,241,0.07), 0 1px 3px rgba(0,0,0,0.04)',
                backdropFilter: 'blur(8px)',
              }}>
                <div style={{ marginBottom: 14 }}>{p.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e1b4b', marginBottom: 3 }}>{p.headline}</div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 500 }}>{p.num} / {p.role}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ fontSize: 12, color: '#7c7abf', zIndex: 1 }}>
          © 2026 Inizio Global · Built for Growth. Driven by Trust.
        </div>
      </div>

      {/* RIGHT — login form */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 56px',
        background: 'linear-gradient(180deg, oklch(100% 0 255) 0%, oklch(98% .02 255) 55%, oklch(96% .04 258) 100%)',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0f172a', margin: '0 0 6px' }}>
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

            <Form.Item style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Password</span>
                <Link to="/forgot-password" style={{ fontSize: 12, color: '#6366f1', fontWeight: 500 }}>Forgot password?</Link>
              </div>
              <Form.Item name="password" noStyle rules={[{ required: true, message: 'Password required' }]}>
                <Input.Password size="large" style={{ borderRadius: 10, fontSize: 14 }} />
              </Form.Item>
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
                      transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#6366f1';
                      e.currentTarget.style.color = '#6366f1';
                      e.currentTarget.style.background = '#eef2ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.color = '#374151';
                      e.currentTarget.style.background = '#fff';
                    }}
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
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
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

          <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', margin: '16px 0 0', lineHeight: 1.6 }}>
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
