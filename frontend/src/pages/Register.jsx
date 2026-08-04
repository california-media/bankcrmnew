import { useEffect, useState } from 'react';
import { Form, Input, Button, Alert, Checkbox } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { registerAgent, clearError } from '../store/slices/authSlice';
import { validateUAELocalPhone, toFullUAEPhone } from '../utils/validatePhone';

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:8000';

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

const inputStyle = { borderRadius: 10, fontSize: 13, borderColor: '#E8E8EE', height: 38 };
const itemStyle  = { marginBottom: 7 };

function Register() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, status, error, registrationPending } = useSelector((s) => s.auth);
  const [form] = Form.useForm();
  const [uaepassError, setUaepassError] = useState(null);

  useEffect(() => {
    if (user) navigate(`/${user.role}`, { replace: true });
  }, [user, navigate]);

  useEffect(() => () => dispatch(clearError()), [dispatch]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const prefill = searchParams.get('uaepass_prefill');
    if (prefill) {
      try {
        const payload = JSON.parse(atob(prefill.split('.')[1]));
        form.setFieldsValue({
          name:            payload.name       || '',
          phone:           payload.phone      || '',
          emiratesId:      payload.emiratesId || '',
          _uaepassSub:     payload.sub        || '',
          _uaepassPrefill: prefill,
        });
      } catch { /* ignore */ }
    }
    const errCode = searchParams.get('uaepass_error');
    if (errCode) setUaepassError(UAE_PASS_ERROR_MESSAGES[errCode] || 'UAE Pass authentication failed.');
  }, [searchParams]);

  const onFinish = (values) => {
    const payload = {
      name:       values.name,
      email:      values.email,
      password:   values.password,
      phone:      values.phone ? toFullUAEPhone(values.phone) : undefined,
      emiratesId: values.emiratesId,
    };
    if (values._uaepassSub) payload.uaepassSub = values._uaepassSub;
    dispatch(registerAgent(payload));
  };

  const handleUaePass = () => { window.location.href = `${API_BASE}/api/auth/uaepass/init`; };
  const isPrefilled   = !!searchParams.get('uaepass_prefill');

  if (registrationPending) {
    return (
      <div className="register-root">
        <div style={{ position:'absolute', top:-160, left:-160, width:480, height:480, borderRadius:'50%', pointerEvents:'none', background:'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 60%)' }} />
        <div style={{ position:'absolute', bottom:-160, right:-100, width:400, height:400, borderRadius:'50%', pointerEvents:'none', background:'radial-gradient(circle, rgba(14,165,233,0.09) 0%, transparent 60%)' }} />

        <div className="register-card" style={{
          background: '#fff',
          border: '1.5px solid #7C3AED',
          borderRadius: 16,
          padding:'48px 40px', textAlign:'center',
          boxShadow:'0 24px 64px -16px rgba(11,15,30,0.10), 0 8px 24px -8px rgba(11,15,30,0.06)',
        }}>
          <div style={{ width:64, height:64, borderRadius:'50%', background:'linear-gradient(135deg,rgba(124,58,237,0.10),rgba(14,165,233,0.08))', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
            <MailOutlined style={{ fontSize:28, color:'#7C3AED' }} />
          </div>
          <h2 style={{ fontSize:22, fontWeight:700, color:'#0B0F1E', margin:'0 0 8px', letterSpacing:'-0.025em' }}>Check your email</h2>
          <p style={{ fontSize:14, color:'#6B7186', lineHeight:1.65, margin:'0 0 20px' }}>
            We sent a verification link to your email. Click it to activate your account.
          </p>
          <p style={{ fontSize:12, color:'#9AA0B4', margin:0 }}>
            Didn't receive it? Check spam or{' '}
            <Link to="/login" style={{ color:'#7C3AED', fontWeight:500 }}>return to login</Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="register-root">

      {/* Orb top-left */}
      <div style={{ position:'absolute', top:-160, left:-160, width:480, height:480, borderRadius:'50%', pointerEvents:'none', background:'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 60%)' }} />
      {/* Orb bottom-right */}
      <div style={{ position:'absolute', bottom:-160, right:-100, width:400, height:400, borderRadius:'50%', pointerEvents:'none', background:'radial-gradient(circle, rgba(14,165,233,0.09) 0%, transparent 60%)' }} />

      <div className="register-card" style={{
        background: '#fff',
        border: '1px solid #E8E8EE',
        borderTop: '3px solid #7C3AED',
        borderRadius: 16,
        padding:'20px 32px 16px',
        boxShadow:'0 24px 64px -16px rgba(11,15,30,0.10), 0 8px 24px -8px rgba(11,15,30,0.06)',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* Logo inside card */}
        <div style={{ textAlign:'center', marginBottom:10 }}>
          <img src="/mysilah.svg" alt="MySilah" style={{ height:32, width:'auto', objectFit:'contain' }} />
        </div>

        {/* Heading */}
        <h2 style={{ fontSize:20, fontWeight:700, color:'#0B0F1E', textAlign:'center', margin:'0 0 2px', letterSpacing:'-0.025em' }}>
          Agent Registration
        </h2>
        <p style={{ fontSize:13, color:'#6B7186', textAlign:'center', margin:'0 0 12px' }}>
          Sign up to submit leads and earn commissions
        </p>

        {uaepassError && <Alert type="error" message={uaepassError} style={{ marginBottom:12, borderRadius:10 }} closable onClose={() => setUaepassError(null)} />}
        {error        && <Alert type="error" message={error}        style={{ marginBottom:12, borderRadius:10 }} />}
        {isPrefilled  && <Alert type="success" message="UAE Pass verified — complete your registration below" style={{ marginBottom:12, borderRadius:10 }} showIcon />}

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="_uaepassSub"     hidden><Input /></Form.Item>
          <Form.Item name="_uaepassPrefill" hidden><Input /></Form.Item>

          <Form.Item name="name"  rules={[{ required:true, message:'Name required' }]}            style={itemStyle}>
            <Input placeholder="Full Name *" style={inputStyle} />
          </Form.Item>
          <Form.Item name="email" rules={[{ required:true, type:'email', message:'Valid email required' }]} style={itemStyle}>
            <Input placeholder="Email *" style={inputStyle} />
          </Form.Item>
          <Form.Item name="phone" rules={[{ validator: validateUAELocalPhone }]} style={itemStyle}>
            <Input
              addonBefore={<span style={{ userSelect: 'none', pointerEvents: 'none', cursor: 'default' }}>🇦🇪 +971</span>}
              placeholder="501234567"
              style={inputStyle}
            />
          </Form.Item>
          <Form.Item name="password" rules={[{ required:true, min:6, message:'Min 6 characters' }]} style={itemStyle}>
            <Input.Password placeholder="Password *" style={inputStyle} />
          </Form.Item>
          <Form.Item name="emiratesId" style={itemStyle}>
            <Input placeholder="Emirates ID (optional) — 784-XXXX-XXXXXXX-X" style={inputStyle} />
          </Form.Item>

          <Form.Item
            name="agreeToTerms" valuePropName="checked" style={{ marginBottom:10, marginTop:2 }}
            rules={[{ validator:(_, v) => v ? Promise.resolve() : Promise.reject('You must accept the Terms and Conditions') }]}
          >
            <Checkbox style={{ fontSize:13, color:'#374151' }}>
              I agree to the{' '}
              <a href="https://mysilah.ae/terms.html" target="_blank" rel="noreferrer" style={{ color:'#7C3AED', fontWeight:500 }}>Terms and Conditions</a>
            </Checkbox>
          </Form.Item>

          <Button
            type="primary" htmlType="submit" loading={status === 'loading'} block size="large"
            style={{
              borderRadius:999, height:48, fontSize:15, fontWeight:600,
              background:'linear-gradient(90deg,#7C3AED,#8B5CF6 50%,#0EA5E9)',
              border:'none', boxShadow:'0 4px 18px rgba(124,58,237,0.38)',
              letterSpacing:'-0.01em',
            }}
          >
            {isPrefilled ? 'Complete Registration' : 'Create account →'}
          </Button>

          {!isPrefilled && (
            <>
              {/* Divider */}
              <div style={{ display:'flex', alignItems:'center', gap:10, margin:'10px 0 8px' }}>
                <div style={{ flex:1, height:1, background:'#E8E8EE' }} />
                <span style={{ fontSize:12, color:'#9AA0B4', whiteSpace:'nowrap' }}>or sign up with UAE PASS</span>
                <div style={{ flex:1, height:1, background:'#E8E8EE' }} />
              </div>

              {/* UAE PASS button */}
              <button
                type="button" onClick={handleUaePass}
                style={{
                  width:'100%', height:48,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                  background:'#fff', border:'1.5px solid #E8E8EE', borderRadius:999,
                  cursor:'pointer', fontSize:14.5, fontWeight:600, color:'#0B0F1E',
                  boxShadow:'0 1px 4px rgba(11,15,30,0.05)',
                  transition:'border-color 0.18s, box-shadow 0.18s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='#7C3AED'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(124,58,237,0.10)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='#E8E8EE'; e.currentTarget.style.boxShadow='0 1px 4px rgba(11,15,30,0.05)'; }}
              >
                <img
                  src="/uae-logo.png"
                  alt="UAE PASS" style={{ height:28, width:'auto', objectFit:'contain' }}
                />
                Sign in with UAE PASS
              </button>
              <p style={{ textAlign:'center', fontSize:11.5, color:'#9AA0B4', margin:'4px 0 0' }}>
                Instant verification using your Emirates ID
              </p>
            </>
          )}
        </Form>

        <p style={{ textAlign:'center', marginTop:10, marginBottom:0, fontSize:12, color:'#9AA0B4', lineHeight:1.5 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color:'#7C3AED', fontWeight:500 }}>Login</Link>
          {' · '}
          <Link to="/register/agency" style={{ color:'#7C3AED', fontWeight:500 }}>Register as Agency</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
