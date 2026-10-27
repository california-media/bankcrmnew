import { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert, Checkbox, Result, Select, Segmented } from 'antd';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { registerAgency, clearError, sendOtp, verifyOtp, resetOtp, setOtpError } from '../store/slices/authSlice';
import { validateUAELocalPhone, toFullUAEPhone } from '../utils/validatePhone';

function RegisterAgency() {
  const dispatch = useDispatch();
  const { status, error, otpStatus, otpError, phoneVerifyToken } = useSelector((s) => s.auth);
  const [form] = Form.useForm();
  const [submitted, setSubmitted] = useState(null); // null | 'agency' | 'super_agent'
  const [searchParams] = useSearchParams();
  const [isSuper, setIsSuper] = useState(searchParams.get('type') === 'super');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (otpStatus !== 'sent' && otpStatus !== 'verifying') return;
    if (resendTimer <= 0) { setCanResend(true); return; }
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [otpStatus, resendTimer]);

  // Start clean (OTP state is shared with the agent registration page) and clean up on leave
  useEffect(() => {
    dispatch(resetOtp());
    return () => { dispatch(resetOtp()); dispatch(clearError()); };
  }, [dispatch]);

  const startOtp = () => {
    const phone = toFullUAEPhone(form.getFieldValue('phone'));
    setOtpDigits(['', '', '', '', '', '']);
    setResendTimer(60);
    setCanResend(false);
    dispatch(sendOtp({ phone }));
  };

  const handleSendOtp = async () => {
    try { await form.validateFields(['phone']); } catch { return; }
    startOtp();
  };

  const handleChangeNumber = () => {
    dispatch(resetOtp());
    setOtpDigits(['', '', '', '', '', '']);
    setResendTimer(60);
    setCanResend(false);
  };

  const handleOtpDigitChange = (index, value) => {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = clean;
    setOtpDigits(next);
    if (clean && index < 5) document.getElementById(`agency-otp-digit-${index + 1}`)?.focus();
  };

  const handleVerifyOtp = () => {
    dispatch(verifyOtp({ phone: toFullUAEPhone(form.getFieldValue('phone')), otp: otpDigits.join('') }));
  };

  const onFinish = async (values) => {
    if (otpStatus !== 'verified') {
      dispatch(setOtpError('Please verify your phone number before submitting'));
      return;
    }
    const result = await dispatch(registerAgency({
      name:         values.name,
      accountType:  isSuper ? 'super_agent' : 'agency',
      ...(isSuper ? {} : { companyName: values.companyName, tradeLicense: values.tradeLicense }),
      email:        values.email,
      phone:        values.phone ? toFullUAEPhone(values.phone) : undefined,
      password:     values.password,
      emiratesId:   values.emiratesId,
      city:         values.city,
      phoneVerifyToken,
    }));
    if (!result.error) setSubmitted(result.payload?.accountType || 'agency');
  };

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5', padding: '16px' }}>
        <Card style={{ width: 480, maxWidth: '100%', textAlign: 'center' }}>
          <Result
            status="success"
            title="Registration Submitted!"
            subTitle={submitted === 'super_agent'
              ? "Your Super Referral Partner registration is pending admin approval. You'll be able to login once approved."
              : "Your agency registration is pending admin approval. You'll be able to login once approved."}
            extra={<Link to="/login"><Button type="primary">Go to Login</Button></Link>}
          />
        </Card>
      </div>
    );
  }

  const itemStyle = { marginBottom: 10 };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5', padding: '16px' }}>
      <Card style={{ width: 460, maxWidth: '100%' }} styles={{ body: { padding: '20px 24px' } }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src="/mysilah.svg" alt="Inizio Global" style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
        </div>
        <Typography.Title level={4} style={{ textAlign: 'center', marginBottom: 10, fontWeight: 600 }}>
          {isSuper ? 'Super Referral Partner Registration' : 'Agency Registration'}
        </Typography.Title>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Segmented
            value={isSuper ? 'super' : 'agency'}
            onChange={(v) => setIsSuper(v === 'super')}
            options={[{ label: 'Register as Agency', value: 'agency' }, { label: 'Register as Super Referral Partner', value: 'super' }]}
          />
        </div>
        <Typography.Paragraph style={{ textAlign: 'center', color: '#888', marginBottom: 16, fontSize: 13 }}>
          Admin will review and approve your registration.
        </Typography.Paragraph>

        {error && <Alert type="error" message={error} style={{ marginBottom: 10 }} onClose={() => dispatch(clearError())} closable />}

        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="name" rules={[{ required: true, message: 'Full name required' }]} style={itemStyle}>
            <Input placeholder="Full Name *" />
          </Form.Item>
          <Form.Item name="phone" rules={[{ required: true, message: 'Phone required' }, { validator: validateUAELocalPhone }]} style={itemStyle}>
            <Input
              addonBefore={<span style={{ userSelect: 'none', pointerEvents: 'none', cursor: 'default' }}>🇦🇪 +971</span>}
              placeholder="501234567"
              disabled={otpStatus === 'verified'}
              suffix={
                otpStatus === 'verified' ? (
                  <span style={{ color: '#16A34A', fontSize: 12, fontWeight: 600 }}>Verified ✓</span>
                ) : (otpStatus === 'idle' || otpStatus === 'sending') ? (
                  <Button type="link" onClick={handleSendOtp} loading={otpStatus === 'sending'} style={{ padding: 0, fontSize: 12, fontWeight: 600, color: '#7C3AED' }}>
                    <img src="/whatsapp-icon.png" width={20} alt="" /> Send OTP
                  </Button>
                ) : null
              }
            />
          </Form.Item>
          {otpError && <Alert type="error" message={otpError} style={{ marginBottom: 8 }} />}
          {(otpStatus === 'sent' || otpStatus === 'verifying') && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                {otpDigits.map((digit, i) => (
                  <Input
                    key={i}
                    id={`agency-otp-digit-${i}`}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(i, e.target.value)}
                    maxLength={1}
                    style={{ width: 38, textAlign: 'center' }}
                  />
                ))}
                <Button type="primary" onClick={handleVerifyOtp} loading={otpStatus === 'verifying'} disabled={otpDigits.some((d) => !d) || otpStatus === 'sending'}>
                  Verify
                </Button>
              </div>
              <div style={{ fontSize: 12, color: '#6B7186', display: 'flex', gap: 12, alignItems: 'center' }}>
                {canResend ? (
                  <Button type="link" size="small" onClick={startOtp} style={{ padding: 0 }}>Resend OTP</Button>
                ) : (
                  `Resend OTP in ${resendTimer}s`
                )}
                <Button type="link" size="small" onClick={handleChangeNumber} style={{ padding: 0 }}>Change number</Button>
              </div>
            </div>
          )}
          <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Valid email required' }]} style={itemStyle}>
            <Input placeholder="Email *" />
          </Form.Item>
          {!isSuper && (
            <>
              <Form.Item name="companyName" rules={[{ required: true, message: 'Company name required' }]} style={itemStyle}>
                <Input placeholder="Company Name *" />
              </Form.Item>
              <Form.Item name="tradeLicense" style={itemStyle}>
                <Input placeholder="Trade License Number (optional, e.g. CN-123456)" />
              </Form.Item>
            </>
          )}
          <Form.Item name="emiratesId" style={itemStyle}>
            <Input placeholder="Emirates ID — 784-XXXX-XXXXXXX-X" />
          </Form.Item>
          <Form.Item name="city" rules={[{ required: true, message: 'City required' }]} style={itemStyle}>
            <Select placeholder="City *">
              <Select.Option value="Abu Dhabi">Abu Dhabi</Select.Option>
              <Select.Option value="Dubai">Dubai</Select.Option>
              <Select.Option value="Sharjah">Sharjah</Select.Option>
              <Select.Option value="Ajman">Ajman</Select.Option>
              <Select.Option value="Umm Al Quwain">Umm Al Quwain</Select.Option>
              <Select.Option value="Ras Al Khaimah">Ras Al Khaimah</Select.Option>
              <Select.Option value="Fujairah">Fujairah</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, min: 6, message: 'Min 6 characters' }]} style={itemStyle}>
            <Input.Password placeholder="Password *" />
          </Form.Item>
          <Form.Item
            name="agreeToTerms" valuePropName="checked" style={itemStyle}
            rules={[{ validator: (_, v) => v ? Promise.resolve() : Promise.reject('You must accept the Terms and Conditions') }]}
          >
            <Checkbox>I agree to the <a href="https://mysilah.ae/terms.html" target="_blank" rel="noreferrer">Terms and Conditions</a></Checkbox>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={status === 'loading'} block>
            Submit for Approval
          </Button>
        </Form>

        <Typography.Paragraph style={{ textAlign: 'center', marginTop: 12, marginBottom: 0, fontSize: 13 }}>
          Already have an account? <Link to="/login">Login</Link>
          <div style={{ display:'flex', alignItems:'center', gap:10, margin:'8px 0' }}>
            <span style={{ flex:1, height:1, background:'#E5E7EB' }} />
            <span style={{ fontSize:12, color:'#9AA0B4' }}>or</span>
            <span style={{ flex:1, height:1, background:'#E5E7EB' }} />
          </div>
          <Link to="/register">Register as Referral Partner</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}

export default RegisterAgency;
