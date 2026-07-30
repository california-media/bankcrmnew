import { useEffect, useState } from 'react';
import { Form, Input, Button, Alert } from 'antd';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/slices/authSlice';

const UAE_PASS_ERROR_MESSAGES = {
  invalid_state:    'Something went wrong during the login, please try again later!',
  token_failed:     'Something went wrong during the login, please try again later!',
  userinfo_failed:  'Something went wrong during the login, please try again later!',
  server_error:     'Something went wrong during the login, please try again later!',
  invalid_request:  'User cancelled the login.',
  login_required:   'User cancelled the login.',
  access_denied:    'User cancelled the login.',
  cancelledOnApp:   'User cancelled the login.',
  cancelledOnWeb:   'User cancelled the login.',
  cancelledOnMobile:'User cancelled the login.',
  unverified_user:  'You are not eligible to access this service. Your account is either not upgraded or you have a visitor account. Please contact MySilah to access the services.',
};

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:8000';

const IC = {
  card:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  shield: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  brief:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
  trend:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  team:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  chart:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  link:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  check:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
};

const CHIPS = [
  { icon: IC.card,   label: 'Credit Cards' },
  { icon: IC.shield, label: 'Personal Loans' },
  { icon: IC.brief,  label: 'SME Loans' },
  { icon: IC.trend,  label: 'Financial Products' },
];

const PILLARS = [
  {
    num: '01', role: 'Referral Partner', headline: 'Earn transparently',
    line1: 'Earn Transparently.',
    line2: 'Submit a Lead. Get Paid.',
    desc: 'Create and manage referrals with real-time tracking, transparent incentives, and a secure onboarding experience.',
  },
  {
    num: '02', role: 'Agency', headline: 'Grow faster',
    line1: 'We Deliver Customers.',
    line2: 'You Grow Faster.',
    desc: 'Manage teams, track performance, leverage partner networks and access comprehensive analytics dashboards.',
  },
  {
    num: '03', role: 'Bank', headline: 'Real results',
    line1: 'Customer Acquisition',
    line2: 'for Financial Institutions.',
    desc: 'Access qualified leads through secure workflows, manage partner relationships, and ensure compliance.',
  },
];

function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, status, error } = useSelector((s) => s.auth);
  const [form] = Form.useForm();
  const [activeStep, setActiveStep] = useState(0);
  const [fade, setFade] = useState(true);
  const [uaepassError, setUaepassError] = useState(null);

  const handleUaePass = () => { window.location.href = `${API_BASE}/api/auth/uaepass/init`; };

  useEffect(() => {
    if (user) navigate(`/${user.role}`, { replace: true });
  }, [user, navigate]);

  useEffect(() => () => dispatch(clearError()), [dispatch]);

  useEffect(() => {
    const errCode = searchParams.get('uaepass_error');
    if (errCode) setUaepassError(UAE_PASS_ERROR_MESSAGES[errCode] || 'UAE Pass authentication failed.');
  }, [searchParams]);

  // Auto-rotate
  useEffect(() => {
    const t = setInterval(() => switchTo((activeStep + 1) % 3), 3800);
    return () => clearInterval(t);
  }, [activeStep]);

  const switchTo = (idx) => {
    setFade(false);
    setTimeout(() => { setActiveStep(idx); setFade(true); }, 180);
  };

  const onFinish = (values) => dispatch(login(values));
  const p = PILLARS[activeStep];

  return (
    <div className="login-root">

      {/* ── LEFT — login form ── */}
      <div className="login-form-col">
        <div style={{ width: '100%', maxWidth: 420 }}>

          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <img src="/mysilah.svg" alt="MySilah" style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
          </div>

          <div style={{
            background: '#fff', borderRadius: 20,
            border: '1px solid #E8E8EE', borderTop: '3px solid #7C3AED',
            padding: '36px 36px 28px',
            boxShadow: '0 4px 32px rgba(124,58,237,0.07), 0 1px 4px rgba(11,15,30,0.04)',
          }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0B0F1E', margin: '0 0 4px', letterSpacing: '-0.025em' }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 14, color: '#6B7186', margin: '0 0 28px' }}>
              Sign in to your referral workspace.
            </p>

            {uaepassError && <Alert type="error" message={uaepassError} style={{ marginBottom: 20, borderRadius: 10 }} closable onClose={() => setUaepassError(null)} />}
            {error && <Alert type="error" message={error} style={{ marginBottom: 20, borderRadius: 10 }} />}

            <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
              <Form.Item
                name="email"
                label={<span style={{ fontSize: 12.5, fontWeight: 600, color: '#374151' }}>Work email</span>}
                rules={[{ required: true, type: 'email', message: 'Valid email required' }]}
                style={{ marginBottom: 16 }}
              >
                <Input size="large" placeholder="you@company.ae" style={{ borderRadius: 10, fontSize: 14, borderColor: '#E8E8EE' }} />
              </Form.Item>

              <Form.Item style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#374151' }}>Password</span>
                  <Link to="/forgot-password" style={{ fontSize: 12, color: '#7C3AED', fontWeight: 500 }}>Forgot password?</Link>
                </div>
                <Form.Item name="password" noStyle rules={[{ required: true, message: 'Password required' }]}>
                  <Input.Password size="large" style={{ borderRadius: 10, fontSize: 14, borderColor: '#E8E8EE' }} />
                </Form.Item>
              </Form.Item>

              <Button
                type="primary" htmlType="submit" loading={status === 'loading'} block size="large"
                style={{
                  borderRadius: 999, height: 48, fontSize: 15, fontWeight: 600,
                  background: 'linear-gradient(90deg,#7C3AED,#8B5CF6 50%,#0EA5E9)',
                  border: 'none', boxShadow: '0 4px 18px rgba(124,58,237,0.38)',
                  marginBottom: 16, letterSpacing: '-0.01em',
                }}
              >
                Continue to dashboard →
              </Button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 14px' }}>
                <div style={{ flex: 1, height: 1, background: '#E8E8EE' }} />
                <span style={{ fontSize: 12, color: '#9AA0B4', whiteSpace: 'nowrap' }}>or sign in with</span>
                <div style={{ flex: 1, height: 1, background: '#E8E8EE' }} />
              </div>

              <button
                type="button" onClick={handleUaePass}
                style={{
                  width: '100%', height: 48,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  background: '#fff', border: '1.5px solid #E8E8EE', borderRadius: 999,
                  cursor: 'pointer', fontSize: 14.5, fontWeight: 600, color: '#0B0F1E',
                  boxShadow: '0 1px 4px rgba(11,15,30,0.05)',
                  transition: 'border-color 0.18s, box-shadow 0.18s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#7C3AED'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.10)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8E8EE'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(11,15,30,0.05)'; }}
              >
                <img
                  src="/uae-logo.png"
                  alt="UAE PASS" style={{ height: 28, width: 'auto', objectFit: 'contain' }}
                />
                Sign in with UAE PASS
              </button>
            </Form>
          </div>

          <p style={{ fontSize: 12, color: '#9AA0B4', textAlign: 'center', margin: '16px 0 0', lineHeight: 1.6 }}>
            New agent?{' '}
            <Link to="/register" style={{ color: '#7C3AED', fontWeight: 500 }}>Create an account</Link>
            {' '}· By signing in you agree to MySilah's Terms.
          </p>
        </div>
      </div>

      {/* ── RIGHT — brand panel ── */}
      <div className="login-brand">

        {/* Ambient orb */}
        <div style={{
          position: 'absolute', bottom: -60, right: -80,
          width: 340, height: 340, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 65%)',
        }} />

        {/* Hero content — fades on tab switch */}
        <div style={{
          position: 'relative', zIndex: 1, flex: 1,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          opacity: fade ? 1 : 0,
          transition: 'opacity 0.18s ease',
        }}>

          {/* Eyebrow */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, width: 'fit-content',
            border: '1px solid #e2e8f0', borderRadius: 999,
            padding: '8px 16px', marginBottom: 28,
            background: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(6px)',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg,#7C3AED,#0EA5E9)',
            }} />
            <span style={{
              fontFamily: "'Geist Mono','Courier New',monospace",
              fontSize: 10.5, fontWeight: 500, color: '#6b7280',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              UAE Banking Referral Infrastructure
            </span>
          </div>

          {/* Dynamic headline */}
          <h1 style={{
            fontWeight: 800, lineHeight: 1.07, letterSpacing: '-0.035em',
            fontSize: 'clamp(30px, 3.4vw, 42px)',
            color: '#0B0F1E', margin: '0 0 6px',
          }}>
            {p.line1}
          </h1>
          <h1 style={{
            fontWeight: 800, lineHeight: 1.07, letterSpacing: '-0.035em',
            fontSize: 'clamp(30px, 3.4vw, 42px)',
            background: 'linear-gradient(90deg,#7C3AED 0%,#8B5CF6 45%,#0EA5E9 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            margin: '0 0 22px',
          }}>
            {p.line2}
          </h1>

          {/* Dynamic description */}
          <p style={{
            fontSize: 15, color: '#6B7186', lineHeight: 1.65,
            margin: '0 0 28px', maxWidth: 460,
          }}>
            {p.desc}
          </p>

          {/* Product chips — constant across tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 36 }}>
            {CHIPS.map((c) => (
              <div key={c.label} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 12.5, fontWeight: 500, color: '#374151',
                background: 'rgba(255,255,255,0.80)', border: '1px solid #E8E8EE',
                padding: '7px 14px', borderRadius: 999, backdropFilter: 'blur(6px)',
              }}>
                <span style={{ color: '#7C3AED' }}>{c.icon}</span>
                {c.label}
              </div>
            ))}
          </div>

          {/* Switcher */}
          <div style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.60)',
            border: '1px solid #E8E8EE',
            borderRadius: 16, overflow: 'hidden',
            backdropFilter: 'blur(10px)',
          }}>
            {PILLARS.map((pillar, i) => {
              const isActive = activeStep === i;
              return (
                <button
                  key={pillar.num}
                  onClick={() => switchTo(i)}
                  style={{
                    flex: 1, padding: '18px 16px', textAlign: 'left',
                    background: isActive ? '#fff' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    borderRight: i < 2 ? '1px solid #E8E8EE' : 'none',
                    transition: 'background 0.25s',
                    position: 'relative',
                  }}
                >
                  <div style={{
                    fontFamily: "'Geist Mono','Courier New',monospace",
                    fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.10em',
                    color: isActive ? '#7C3AED' : '#9AA0B4',
                    fontWeight: 500, marginBottom: 5, lineHeight: 1.4,
                    transition: 'color 0.25s',
                  }}>
                    {pillar.num} / {pillar.role}
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 600,
                    ...(isActive
                      ? { background: 'linear-gradient(90deg,#7C3AED,#0EA5E9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }
                      : { color: '#0B0F1E' }
                    ),
                    transition: 'color 0.25s',
                  }}>
                    {pillar.headline}
                  </div>
                  {isActive && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
                      background: 'linear-gradient(90deg,#7C3AED,#0EA5E9)',
                      borderRadius: '2px 2px 0 0',
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'relative', zIndex: 1, fontSize: 12, color: '#9AA0B4', textAlign: 'right' }}>
          © 2026 Silah L.L.C-FZ · Built for Growth. Driven by Trust.
        </div>
      </div>
    </div>
  );
}

export default Login;
