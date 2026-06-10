import { useState } from 'react';
import { Form, Input, Button, Alert } from 'antd';
import { Link } from 'react-router-dom';
import { ArrowLeftOutlined, MailOutlined } from '@ant-design/icons';
import api from '../api/client';

export default function ForgotPassword() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const onFinish = async ({ email }) => {
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #eef2ff 0%, #f0f4ff 40%, #e8f0fe 100%)',
      padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.7)',
        padding: '40px 36px',
        boxShadow: '0 8px 40px rgba(99,102,241,0.12)',
      }}>
        <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6366f1', fontWeight: 500, marginBottom: 28 }}>
          <ArrowLeftOutlined /> Back to login
        </Link>

        <div style={{ marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <MailOutlined style={{ fontSize: 22, color: '#6366f1' }} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>Forgot password?</h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Enter your email and we'll send a reset link.
          </p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📬</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', marginBottom: 8 }}>Check your inbox</div>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
              If that email is registered, a reset link has been sent. Check your spam folder too.
            </p>
          </div>
        ) : (
          <>
            {error && <Alert type="error" message={error} style={{ marginBottom: 16, borderRadius: 8 }} />}
            <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
              <Form.Item
                name="email"
                label={<span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Work email</span>}
                rules={[{ required: true, type: 'email', message: 'Valid email required' }]}
                style={{ marginBottom: 20 }}
              >
                <Input size="large" placeholder="you@company.ae" style={{ borderRadius: 10, fontSize: 14 }} />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
                style={{
                  borderRadius: 10, height: 48, fontSize: 15, fontWeight: 700,
                  background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
                }}
              >
                Send reset link
              </Button>
            </Form>
          </>
        )}
      </div>
    </div>
  );
}
