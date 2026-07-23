import { useEffect, useState } from 'react';
import { Form, Input, Button, Alert, Checkbox } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { registerAgent, clearError } from '../store/slices/authSlice';

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:8000';

const UAE_PASS_ERROR_MESSAGES = {
  invalid_state:   'Session expired. Please try again.',
  token_failed:    'UAE Pass authentication failed. Please try again.',
  userinfo_failed: 'Could not retrieve your UAE Pass profile. Please try again.',
  server_error:    'Something went wrong. Please try again.',
  access_denied:   'UAE Pass access was denied.',
};

const inputStyle = { borderRadius: 10, fontSize: 14, borderColor: '#E8E8EE', height: 42 };
const itemStyle  = { marginBottom: 10 };

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
      phone:      values.phone,
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
        {/* Orbs */}
        <div style={{ position:'absolute', top:-160, left:-160, width:480, height:480, borderRadius:'50%', pointerEvents:'none', background:'radial-gradient(circle, rgba(124,58,237,0.10) 0%, transparent 60%)' }} />
        <div style={{ position:'absolute', bottom:-160, right:-100, width:400, height:400, borderRadius:'50%', pointerEvents:'none', background:'radial-gradient(circle, rgba(14,165,233,0.09) 0%, transparent 60%)' }} />

        <div className="register-card" style={{
          background:'#fff', borderRadius:16, border:'1px solid #E8E8EE', borderTop:'3px solid #7C3AED',
          padding:'48px 40px', textAlign:'center',
          boxShadow:'0 24px 64px -16px rgba(11,15,30,0.14), 0 8px 24px -8px rgba(11,15,30,0.07)',
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
        background:'#fff', borderRadius:16, border:'1px solid #E8E8EE', borderTop:'3px solid #7C3AED',
        padding:'32px 36px 28px',
        boxShadow:'0 24px 64px -16px rgba(11,15,30,0.14), 0 8px 24px -8px rgba(11,15,30,0.07)',
      }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <img src="/mysilah.svg" alt="MySilah" style={{ height:38, width:'auto', objectFit:'contain' }} />
        </div>

        {/* Heading */}
        <h2 style={{ fontSize:22, fontWeight:700, color:'#0B0F1E', textAlign:'center', margin:'0 0 4px', letterSpacing:'-0.025em' }}>
          Agent Registration
        </h2>
        <p style={{ fontSize:13.5, color:'#6B7186', textAlign:'center', margin:'0 0 20px' }}>
          Sign up to submit leads and earn commissions
        </p>

        {uaepassError && <Alert type="error" message={uaepassError} style={{ marginBottom:12, borderRadius:10 }} closable onClose={() => setUaepassError(null)} />}
        {error        && <Alert type="error" message={error}        style={{ marginBottom:12, borderRadius:10 }} />}
        {isPrefilled  && <Alert type="success" message="UAE Pass verified — complete your registration below" style={{ marginBottom:12, borderRadius:10 }} showIcon />}

        {!isPrefilled && (
          <>
            {/* UAE PASS button */}
            <button
              type="button" onClick={handleUaePass}
              style={{
                width:'100%', height:48,
                display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                background:'#fff', border:'1.5px solid #E8E8EE', borderRadius:999,
                cursor:'pointer', fontSize:14.5, fontWeight:600, color:'#0B0F1E',
                boxShadow:'0 1px 4px rgba(11,15,30,0.05)',
                transition:'border-color 0.18s, box-shadow 0.18s', marginBottom:6,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#7C3AED'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(124,58,237,0.10)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='#E8E8EE'; e.currentTarget.style.boxShadow='0 1px 4px rgba(11,15,30,0.05)'; }}
            >
              <img
                src="https://www.uaepass.ae/content/dam/uae-pass/images/logo/uae-pass-logo.svg"
                alt="UAE PASS" style={{ height:22 }}
                onError={e => { e.target.style.display='none'; }}
              />
              Sign in with UAE PASS
            </button>
            <p style={{ textAlign:'center', fontSize:11.5, color:'#9AA0B4', margin:'0 0 4px' }}>
              Instant verification using your Emirates ID
            </p>

            {/* Divider */}
            <div style={{ display:'flex', alignItems:'center', gap:10, margin:'14px 0' }}>
              <div style={{ flex:1, height:1, background:'#E8E8EE' }} />
              <span style={{ fontSize:12, color:'#9AA0B4', whiteSpace:'nowrap' }}>or register manually</span>
              <div style={{ flex:1, height:1, background:'#E8E8EE' }} />
            </div>
          </>
        )}

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="_uaepassSub"     hidden><Input /></Form.Item>
          <Form.Item name="_uaepassPrefill" hidden><Input /></Form.Item>

          <Form.Item name="name"  rules={[{ required:true, message:'Name required' }]}            style={itemStyle}>
            <Input placeholder="Full Name *" style={inputStyle} />
          </Form.Item>
          <Form.Item name="email" rules={[{ required:true, type:'email', message:'Valid email required' }]} style={itemStyle}>
            <Input placeholder="Email *" style={inputStyle} />
          </Form.Item>
          <Form.Item name="phone" style={itemStyle}>
            <Input placeholder="Phone (+971 50 xxx xxxx)" style={inputStyle} />
          </Form.Item>
          <Form.Item name="password" rules={[{ required:true, min:6, message:'Min 6 characters' }]} style={itemStyle}>
            <Input.Password placeholder="Password *" style={inputStyle} />
          </Form.Item>
          <Form.Item name="emiratesId" style={itemStyle}>
            <Input placeholder="Emirates ID (optional) — 784-XXXX-XXXXXXX-X" style={inputStyle} />
          </Form.Item>

          <Form.Item
            name="agreeToTerms" valuePropName="checked" style={{ marginBottom:16, marginTop:4 }}
            rules={[{ validator:(_, v) => v ? Promise.resolve() : Promise.reject('You must accept the Terms and Conditions') }]}
          >
            <Checkbox style={{ fontSize:13, color:'#374151' }}>
              I agree to the{' '}
              <Link to="/terms" target="_blank" style={{ color:'#7C3AED', fontWeight:500 }}>Terms and Conditions</Link>
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
        </Form>

        <p style={{ textAlign:'center', marginTop:16, marginBottom:0, fontSize:12.5, color:'#9AA0B4', lineHeight:1.6 }}>
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
