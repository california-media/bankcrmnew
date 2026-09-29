import { useState } from 'react';
import { Form, Input, Button, Alert } from 'antd';
import { SearchOutlined, CheckCircleFilled, ClockCircleOutlined } from '@ant-design/icons';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const GRAD = 'linear-gradient(135deg,#7C3AED 0%,#8B5CF6 45%,#0EA5E9 100%)';
const MONO = "'Geist Mono', ui-monospace, monospace";

const STATUS_PILL = {
  draft:        { bg: '#FAFAFB', border: '#E8E8EE', dot: '#9AA0B4', text: '#6B7186', label: 'Draft' },
  submitted:    { bg: '#EFF7FF', border: '#C8E0FB', dot: '#0EA5E9', text: '#0E7490', label: 'Submitted' },
  under_review: { bg: '#FFF7E0', border: '#FFE9A8', dot: '#EAB308', text: '#B47A1F', label: 'Under Review' },
  assigned:     { bg: '#F4EEFF', border: '#E6DAFF', dot: '#8B5CF6', text: '#7C3AED', label: 'Assigned' },
  approved:     { bg: '#F1FBF5', border: '#BFEAD0', dot: '#10A36A', text: '#10A36A', label: 'Approved' },
  rejected:     { bg: '#FEF1F1', border: '#FACFCF', dot: '#D14343', text: '#D14343', label: 'Rejected' },
  disbursed:    { bg: '#F6F5FB', border: '#DCD4F5', dot: '#7C3AED', text: '#7C3AED', label: 'Disbursed' },
};

const PRODUCT_LABEL = {
  credit_card: 'Credit Card',
  loan: 'Loan',
  account: 'Account',
};

const LOAN_TYPE_LABEL = {
  pdc: 'PDC',
  new_stl_loan: 'New STL Loan',
  buyout: 'Buyout',
  business_loan: 'Business Loan',
  sme_new_loan: 'SME New Loan',
  sme_buyout_loan: 'SME Buyout Loan',
  pos_loan_non_bank: 'POS Loan / Non Bank',
  pos_loan: 'POS Loan',
  auto_loan: 'Auto Loan',
  mortgage_new: 'Mortgage Loan (New)',
  mortgage_buyout: 'Mortgage Loan (Buyout)',
};

const ACCOUNT_TYPE_LABEL = {
  business_account: 'Business Account',
  current_account: 'Current Account',
  savings_account: 'Saving Account',
};

const CARD_TYPE_LABEL = {
  regular: 'Regular',
  premium: 'Premium',
  rewards_lifestyle: 'Rewards & Lifestyle',
  travel: 'Travel',
  ecommerce: 'E-commerce',
  legacy: 'Legacy',
};

const itemStyle = { marginBottom: 16 };
const inputStyle = { borderRadius: 10, padding: '10px 12px', fontSize: 14 };

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : null;

const fmtDateTime = (d) => d
  ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : null;

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const detailRowStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '9px 0', borderBottom: '1px solid #F1F5F9', fontSize: 13,
};
const detailLabelStyle = { color: '#9AA0B4', fontFamily: MONO, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em' };
const detailValueStyle = { color: '#1A2036', fontWeight: 600, textAlign: 'right' };

export default function TrackStatus() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const onSearch = async (values) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await axios.get(`${API_BASE}/public/track-status`, {
        params: { leadNumber: values.leadNumber.trim(), firstName: values.firstName.trim() },
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pill = result ? STATUS_PILL[result.status] || STATUS_PILL.draft : null;

  return (
    <div style={{
      minHeight: '100vh', background: '#fff', position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '56px 16px 40px',
    }}>
      {/* Glow orbs — same treatment as the marketing site's hero section */}
      <div style={{ position: 'absolute', top: -200, right: -200, width: 700, height: 700, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, rgba(124,58,237,0.10), transparent 60%)' }} />
      <div style={{ position: 'absolute', bottom: -200, left: -200, width: 600, height: 600, borderRadius: '50%', pointerEvents: 'none', background: 'radial-gradient(circle, rgba(14,165,233,0.08), transparent 60%)' }} />

      <style>{`
        .ts-shell { max-width: 460px; }
        @media (min-width: 900px) {
          .ts-shell.has-result { max-width: 860px; }
        }
        .ts-inner.has-result { display: block; }
        @media (min-width: 900px) {
          .ts-inner.has-result { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: start; }
        }
        .ts-result { margin-top: 26px; padding-top: 22px; border-top: 1px dashed #E8E8EE; }
        @media (min-width: 900px) {
          .ts-inner.has-result .ts-result { margin-top: 0; padding-top: 0; border-top: none; border-left: 1px dashed #E8E8EE; padding-left: 32px; margin-left: 16px; }
        }
      `}</style>
      <div className={`ts-shell${result ? ' has-result' : ''}`} style={{ position: 'relative', zIndex: 1, width: '100%' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <img src="/mysilah.svg" alt="MySilah" style={{ height: 48, width: 'auto', objectFit: 'contain', margin: '0 auto' }} />
        </div>

        {/* Heading */}
        <h1 style={{
          textAlign: 'center', fontWeight: 700, fontSize: 'clamp(24px,4vw,30px)', lineHeight: 1.15,
          letterSpacing: '-0.03em', color: '#0B0F1E', margin: '0 0 8px',
        }}>
          Track your{' '}
          <span style={{ background: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
            Application Status
          </span>
        </h1>
        <p style={{ textAlign: 'center', fontSize: 14, color: '#6B7186', margin: '0 0 32px', lineHeight: 1.6 }}>
          Enter your reference number and first name below to see where things stand.
        </p>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #E8E8EE',
          boxShadow: '0 24px 64px -16px rgba(11,15,30,0.10), 0 8px 24px -8px rgba(11,15,30,0.06)',
          position: 'relative', overflow: 'hidden', padding: '28px 28px 24px',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: GRAD }} />

          <div className={`ts-inner${result ? ' has-result' : ''}`}>
          <Form form={form} layout="vertical" onFinish={onSearch} requiredMark={false} disabled={loading}>
            <Form.Item
              name="leadNumber"
              label={<span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#374151' }}>Reference Number</span>}
              rules={[{ required: true, message: 'Reference number is required' }]}
              style={itemStyle}
            >
              <Input placeholder="e.g. LD-A1B2C3-0001" autoComplete="off" style={inputStyle} />
            </Form.Item>
            <Form.Item
              name="firstName"
              label={<span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#374151' }}>First Name</span>}
              rules={[{ required: true, message: 'First name is required' }]}
              style={itemStyle}
            >
              <Input placeholder="First name on the application" autoComplete="off" style={inputStyle} />
            </Form.Item>

            {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16, borderRadius: 10 }} />}

            <Button
              type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading} block size="large"
              style={{ borderRadius: 10, height: 46, fontWeight: 600, fontSize: 15, background: GRAD, border: 'none', boxShadow: '0 12px 32px -10px rgba(124,58,237,0.5)' }}
            >
              Check Status
            </Button>
          </Form>

          {result && (
            <div className="ts-result">
              {/* Status */}
              <div style={{ textAlign: 'center', marginBottom: 22 }}>
                <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, color: '#9AA0B4', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
                  Current Status
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: pill.bg, border: `1px solid ${pill.border}`, color: pill.text,
                  padding: '7px 18px', borderRadius: 999, fontSize: 15, fontWeight: 700,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: pill.dot }} />
                  {pill.label}
                </span>
              </div>

              {/* Application details */}
              <div style={{ marginBottom: 8 }}>
                {result.customerName && (
                  <div style={{ ...detailRowStyle, borderTop: '1px solid #F1F5F9' }}>
                    <span style={detailLabelStyle}>Name</span>
                    <span style={detailValueStyle}>{result.customerName}</span>
                  </div>
                )}
                <div style={{ ...detailRowStyle, borderTop: result.customerName ? undefined : '1px solid #F1F5F9' }}>
                  <span style={detailLabelStyle}>Reference</span>
                  <span style={{ ...detailValueStyle, fontFamily: MONO, fontSize: 12 }}>{result.leadNumber}</span>
                </div>
                <div style={detailRowStyle}>
                  <span style={detailLabelStyle}>Product</span>
                  <span style={detailValueStyle}>
                    {PRODUCT_LABEL[result.productType] || result.productType}
                    {(result.loanType && LOAN_TYPE_LABEL[result.loanType]) && ` — ${LOAN_TYPE_LABEL[result.loanType]}`}
                    {(result.accountType && ACCOUNT_TYPE_LABEL[result.accountType]) && ` — ${ACCOUNT_TYPE_LABEL[result.accountType]}`}
                  </span>
                </div>
                {result.bankName && (
                  <div style={detailRowStyle}>
                    <span style={detailLabelStyle}>Bank</span>
                    <span style={detailValueStyle}>{result.bankName}</span>
                  </div>
                )}
                {result.productName && (
                  <div style={detailRowStyle}>
                    <span style={detailLabelStyle}>Plan</span>
                    <span style={detailValueStyle}>{result.productName}</span>
                  </div>
                )}
                {result.cardType && (
                  <div style={detailRowStyle}>
                    <span style={detailLabelStyle}>Card Type</span>
                    <span style={detailValueStyle}>{CARD_TYPE_LABEL[result.cardType] || result.cardType}</span>
                  </div>
                )}
                {result.loanAmount != null && (
                  <div style={detailRowStyle}>
                    <span style={detailLabelStyle}>Amount</span>
                    <span style={detailValueStyle}>{aed(result.loanAmount)}</span>
                  </div>
                )}
                <div style={detailRowStyle}>
                  <span style={detailLabelStyle}>Submitted</span>
                  <span style={detailValueStyle}>{fmtDate(result.submittedAt)}</span>
                </div>
                <div style={{ ...detailRowStyle, borderBottom: 'none' }}>
                  <span style={detailLabelStyle}>Last Updated</span>
                  <span style={detailValueStyle}>{fmtDate(result.updatedAt)}</span>
                </div>
              </div>

              {/* Actions completed */}
              {result.actions?.length > 0 && (
                <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px dashed #E8E8EE' }}>
                  <div style={detailLabelStyle}>Processing Steps</div>
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {result.actions.map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: a.done ? '#1A2036' : '#9AA0B4' }}>
                        {a.done
                          ? <CheckCircleFilled style={{ color: '#10A36A', fontSize: 16 }} />
                          : <ClockCircleOutlined style={{ color: '#D1D5DB', fontSize: 16 }} />}
                        <span style={{ fontWeight: a.done ? 600 : 500 }}>{a.label}</span>
                        {a.done && <span style={{ marginLeft: 'auto', fontSize: 10.5, fontFamily: MONO, color: '#10A36A', textTransform: 'uppercase' }}>Done</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status timeline */}
              {result.history?.length > 0 && (
                <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px dashed #E8E8EE' }}>
                  <div style={detailLabelStyle}>Timeline</div>
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' }}>
                    {result.history.map((h, i) => {
                      const hp = STATUS_PILL[h.status] || STATUS_PILL.draft;
                      const isLast = i === result.history.length - 1;
                      return (
                        <div key={i} style={{ display: 'flex', gap: 12 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: hp.dot, flexShrink: 0, marginTop: 3 }} />
                            {!isLast && <span style={{ width: 2, flex: 1, background: '#E8E8EE', minHeight: 22 }} />}
                          </div>
                          <div style={{ paddingBottom: isLast ? 0 : 16 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2036' }}>{hp.label}</div>
                            <div style={{ fontSize: 11.5, color: '#9AA0B4', marginTop: 1 }}>{fmtDateTime(h.changedAt)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#9AA0B4', marginTop: 24 }}>
          Need help? Contact your agent or agency for further assistance.
        </p>
      </div>
    </div>
  );
}
