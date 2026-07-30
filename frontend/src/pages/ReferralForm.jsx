import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Form, Input, InputNumber, Select, Button, Alert, Result, Row, Col, Spin } from 'antd';
import { SendOutlined, ReloadOutlined, CreditCardOutlined, BankOutlined } from '@ant-design/icons';
import axios from 'axios';
import { feeTypeLabel, feeTypeColors } from '../utils/cardFee';
import { validateUAELocalPhone, toFullUAEPhone } from '../utils/validatePhone';

const UPLOADS_BASE = import.meta.env.VITE_UPLOADS_BASE || 'https://mysilah.s3.us-east-1.amazonaws.com';
const API_BASE     = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const NATIONALITIES = [
  'UAE', 'Saudi Arabia', 'Kuwait', 'Qatar', 'Bahrain', 'Oman',
  'Egypt', 'Jordan', 'Lebanon', 'Syria', 'Iraq', 'Yemen',
  'India', 'Pakistan', 'Bangladesh', 'Philippines', 'Sri Lanka',
  'United Kingdom', 'United States', 'Canada', 'Australia',
  'Germany', 'France', 'Italy', 'Spain', 'Netherlands',
  'China', 'Japan', 'South Korea', 'Indonesia', 'Malaysia',
  'Nigeria', 'Kenya', 'South Africa', 'Other',
];

const VISA_TYPES = [
  'UAE Resident', 'Employment Visa', 'Investor Visa', 'Free Zone Visa',
  'Family Visa', 'Golden Visa', 'Tourist Visa', 'Other',
];

const CITIES = [
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah',
  'Fujairah', 'Umm Al Quwain', 'Al Ain', 'Other',
];

const LOAN_TYPE_OPTIONS = [
  { value: 'new_stl_loan',  label: 'New STL Loan' },
  { value: 'buyout',        label: 'Buyout' },
  { value: 'pdc',           label: 'PDC' },
  { value: 'business_loan', label: 'Business Loan' },
];

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

function buildBracketOptions(brackets) {
  if (!brackets?.length) return [];
  return [...brackets]
    .sort((a, b) => a.minimumSalary - b.minimumSalary)
    .map((b) => ({
      value: b.minimumSalary,
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Min. Salary {aed(b.minimumSalary)}</span>
          {b.feeType && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
              background: feeTypeColors(b.feeType).bg,
              color:      feeTypeColors(b.feeType).text,
              border:     `1px solid ${feeTypeColors(b.feeType).border}`,
            }}>
              {feeTypeLabel(b.feeType)}
            </span>
          )}
        </span>
      ),
      payable: b.payable,
      feeType: b.feeType,
    }));
}

const MB = { marginBottom: 8 };
const panelStyle = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #e8ecf4',
  borderTop: '3px solid #7C3AED',
  boxShadow: '0 4px 18px rgba(124,58,237,0.07)',
  padding: '16px 18px',
};
const sectionTitle = {
  display: 'flex', alignItems: 'center', gap: 8,
  marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f1f5f9',
};

export default function ReferralForm() {
  const { code } = useParams();
  const [form] = Form.useForm();
  const [agentName,       setAgentName]       = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [submitting,      setSubmitting]      = useState(false);
  const [submitted,       setSubmitted]       = useState(false);
  const [error,           setError]           = useState(null);
  const [invalid,         setInvalid]         = useState(false);
  const [productType,     setProductType]     = useState('credit_card');
  const [banks,           setBanks]           = useState([]);
  const [selectedBank,    setSelectedBank]    = useState(null);
  const [cardProducts,    setCardProducts]    = useState([]);
  const [loanProducts,    setLoanProducts]    = useState([]);
  const [selectedCard,    setSelectedCard]    = useState(null);
  const [selectedLoan,    setSelectedLoan]    = useState(null);
  const [selectedBracket, setSelectedBracket] = useState(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const draftLeadIdRef = useRef(null);
  const draftTimerRef  = useRef(null);
  const [draftStatus,  setDraftStatus]  = useState(null); // 'saving' | 'saved'

  useEffect(() => {
    axios.get(`${API_BASE}/public/ref/${code}`)
      .then((res) => setAgentName(res.data.agentName))
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false));
  }, [code]);

  useEffect(() => {
    setProductsLoading(true);
    Promise.all([
      axios.get(`${API_BASE}/public/banks`),
      axios.get(`${API_BASE}/public/card-products`),
      axios.get(`${API_BASE}/public/loan-products`),
    ])
      .then(([banksRes, cardsRes, loansRes]) => {
        setBanks(banksRes.data);
        setCardProducts(cardsRes.data);
        setLoanProducts(loansRes.data);
      })
      .catch(() => {})
      .finally(() => setProductsLoading(false));
  }, []);

  const autoSelectMinBracket = (brackets) => {
    if (!brackets?.length) { setSelectedBracket(null); form.resetFields(['salaryBracket']); return; }
    const min = [...brackets].sort((a, b) => a.minimumSalary - b.minimumSalary)[0];
    setSelectedBracket(min);
    form.setFieldValue('salaryBracket', min.minimumSalary);
  };

  const onCardSelect = (id) => {
    const card = cardProducts.find((c) => c._id === id) || null;
    setSelectedCard(card);
    autoSelectMinBracket(card?.commissionBrackets);
  };

  const onLoanSelect = (id) => {
    const loan = loanProducts.find((l) => l._id === id) || null;
    setSelectedLoan(loan);
    autoSelectMinBracket(loan?.commissionBrackets);
  };

  const onBracketSelect = (minSalary) => {
    const product  = productType === 'credit_card' ? selectedCard : selectedLoan;
    const brackets = product?.commissionBrackets || [];
    setSelectedBracket(brackets.find((b) => b.minimumSalary === minSalary) || null);
  };

  const onProductTypeChange = (val) => {
    setProductType(val);
    setSelectedBank(null);
    setSelectedCard(null);
    setSelectedLoan(null);
    setSelectedBracket(null);
    form.resetFields(['bank', 'cardProduct', 'loanProduct', 'loanType', 'loanAmount', 'salaryBracket']);
  };

  const onBankSelect = (bankId) => {
    setSelectedBank(bankId);
    setSelectedCard(null);
    setSelectedLoan(null);
    setSelectedBracket(null);
    form.resetFields(['cardProduct', 'loanProduct', 'salaryBracket']);
  };

  const activeBrackets = productType === 'credit_card'
    ? buildBracketOptions(selectedCard?.commissionBrackets)
    : buildBracketOptions(selectedLoan?.commissionBrackets);

  const bankOptions = banks.map(b => ({ value: b._id, label: b.name }));
  const filteredCardProducts = selectedBank ? cardProducts.filter(c => c.bank?._id === selectedBank) : [];
  const filteredLoanProducts = selectedBank ? loanProducts.filter(l => l.bank?._id === selectedBank) : [];

  const onValuesChange = (_, all) => {
    const { customerName, phone, email, salary } = all;
    if (!customerName?.trim() || !phone?.trim() || !email?.includes('@') || !salary || salary < 5000) return;
    clearTimeout(draftTimerRef.current);
    setDraftStatus('saving');
    draftTimerRef.current = setTimeout(async () => {
      try {
        const payload = {
          customerName: customerName.trim(), phone: toFullUAEPhone(phone),
          email: email.trim(), salary,
          nationality: all.nationality, city: all.city,
          companyName: all.companyName, jobTitle: all.jobTitle,
          yearsOfExperience: all.yearsOfExperience,
        };
        if (draftLeadIdRef.current) payload.leadId = draftLeadIdRef.current;
        const res = await axios.post(`${API_BASE}/public/ref/${code}/draft`, payload);
        draftLeadIdRef.current = res.data.leadId;
        setDraftStatus('saved');
      } catch {
        setDraftStatus(null);
      }
    }, 1500);
  };

  const onFinish = async (values) => {
    clearTimeout(draftTimerRef.current);
    setSubmitting(true);
    setError(null);
    try {
      const payload = { ...values, productType, phone: toFullUAEPhone(values.phone) };
      if (draftLeadIdRef.current) payload.leadId = draftLeadIdRef.current;
      const res = await axios.post(`${API_BASE}/public/ref/${code}/submit`, payload);
      if (res.data.redirectUrl) {
        window.location.href = res.data.redirectUrl;
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const centeredPage = (children) => (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg,#f5f3ff 0%,#ede9fe 100%)', padding: '24px 16px' }}>
      {children}
    </div>
  );

  if (loading)  return centeredPage(<Spin size="large" />);

  if (invalid)  return centeredPage(
    <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', maxWidth: 400 }}>
      <Result status="404" title="Invalid Link" subTitle="This referral link is not valid or has expired." />
    </div>
  );

  if (submitted) return centeredPage(
    <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center', maxWidth: 440 }}>
      <Result
        status="success"
        title="Application Submitted!"
        subTitle="Thank you! Your details have been received. Our team will be in touch shortly."
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => { setSubmitted(false); form.resetFields(); setSelectedBank(null); setSelectedCard(null); setSelectedLoan(null); setSelectedBracket(null); setProductType('credit_card'); draftLeadIdRef.current = null; setDraftStatus(null); }}>
            Submit Another
          </Button>
        }
      />
    </div>
  );

  const accentColor = productType === 'credit_card' ? '#7C3AED' : '#16a34a';

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#f5f3ff 0%,#ede9fe 100%)', padding: '20px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <style>{`
        .ref-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
        @media (max-width: 680px) {
          .ref-form-grid { grid-template-columns: 1fr; }
          .ref-form-outer { border-radius: 14px !important; box-shadow: 0 4px 24px rgba(124,58,237,0.12) !important; }
          .ref-form-body { padding: 12px !important; }
        }
      `}</style>
      <div className="ref-form-outer" style={{ width: '100%', maxWidth: 1040, borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 48px rgba(124,58,237,0.15)' }}>

        {/* Two-column body */}
        <div className="ref-form-body" style={{ background: '#f8f9fc', padding: '16px' }}>
          {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} showIcon />}

          <Form form={form} layout="vertical" onFinish={onFinish} onValuesChange={onValuesChange} size="middle">
            <div className="ref-form-grid">

              {/* LEFT — Client Info */}
              <div style={panelStyle}>
                <div style={sectionTitle}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1e1b4b' }}>Client Information</span>
                </div>

                <Row gutter={10}>
                  <Col span={12}>
                    <Form.Item name="customerName" label="Full Name (as per Emirates ID)" rules={[{ required: true, message: 'Required' }]} style={MB}>
                      <Input placeholder="Mohammed Ahmed" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="phone" label="Mobile Number" rules={[{ required: true, message: 'Required' }, { validator: validateUAELocalPhone }]} style={MB}>
                      <Input
                        addonBefore={<span style={{ userSelect: 'none', pointerEvents: 'none', cursor: 'default' }}>🇦🇪 +971</span>}
                        placeholder="501234567"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Required' }, { type: 'email', message: 'Invalid' }]} style={MB}>
                      <Input placeholder="client@email.com" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="salary" label="Salary (AED)" rules={[{ required: true, message: 'Required' }, { type: 'number', min: 5000, message: 'Minimum salary is AED 5,000' }]} style={MB}>
                      <InputNumber min={0} step={500} placeholder="8000" style={{ width: '100%' }} formatter={v => v ? `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''} parser={v => `${v}`.replace(/,/g, '')} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="nationality" label="Nationality" style={MB}>
                      <Select placeholder="Select" showSearch optionFilterProp="label" options={NATIONALITIES.map(n => ({ value: n, label: n }))} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="city" label="City" style={MB}>
                      <Select placeholder="Select" options={CITIES.map(c => ({ value: c, label: c }))} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="companyName" label="Company" style={MB}>
                      <Input placeholder="Your company" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="jobTitle" label="Job Title" style={MB}>
                      <Input placeholder="Sales Manager" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="yearsOfExperience" label="Length of Service (years)" style={MB}>
                      <InputNumber min={0} max={50} step={1} placeholder="3" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              {/* RIGHT — Product + Notes + Submit */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Product panel */}
                <div style={{ ...panelStyle, borderTopColor: accentColor }}>
                  <div style={sectionTitle}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: productType === 'credit_card' ? '#f3e8ff' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s' }}>
                      {productType === 'credit_card'
                        ? <CreditCardOutlined style={{ color: '#7C3AED', fontSize: 13 }} />
                        : <BankOutlined style={{ color: '#16a34a', fontSize: 13 }} />
                      }
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1e1b4b' }}>Product</span>
                  </div>

                  {/* Type toggle */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    {[
                      { value: 'credit_card', label: 'Credit Card', icon: <CreditCardOutlined />, color: '#7C3AED', bg: '#f3e8ff', border: '#7C3AED' },
                      { value: 'loan',        label: 'Loan',        icon: <BankOutlined />,       color: '#16a34a', bg: '#f0fdf4', border: '#22c55e' },
                    ].map((opt) => {
                      const active = productType === opt.value;
                      return (
                        <button key={opt.value} type="button" onClick={() => onProductTypeChange(opt.value)}
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                            fontWeight: active ? 700 : 500,
                            border: `2px solid ${active ? opt.border : '#e2e8f0'}`,
                            background: active ? opt.bg : '#f8fafc',
                            color: active ? opt.color : '#94a3b8',
                            transition: 'all 0.15s',
                            boxShadow: active ? `0 2px 8px ${opt.border}30` : 'none',
                          }}
                        >
                          {opt.icon} {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Credit card fields */}
                  {productType === 'credit_card' && (
                    <>
                      <Form.Item name="bank" label="Bank" rules={[{ required: true, message: 'Select a bank' }]} style={MB}>
                        <Select
                          loading={productsLoading} showSearch placeholder="Select bank"
                          filterOption={(input, opt) => opt.label?.toLowerCase().includes(input.toLowerCase())}
                          options={bankOptions}
                          onChange={onBankSelect}
                        />
                      </Form.Item>
                      <Form.Item name="cardProduct" label="Card Product" rules={[{ required: true, message: 'Select a card product' }]} style={MB}>
                        <Select
                          loading={productsLoading} showSearch placeholder={selectedBank ? 'Select card product' : 'Select a bank first'}
                          disabled={!selectedBank}
                          filterOption={(input, opt) => opt.label?.toLowerCase().includes(input.toLowerCase())}
                          options={filteredCardProducts.map(c => ({ value: c._id, label: c.name }))}
                          onChange={onCardSelect}
                        />
                      </Form.Item>
                      {selectedCard && activeBrackets.length > 0 && (
                        <Form.Item name="salaryBracket" label="Salary Bracket" rules={[{ required: true, message: 'Select salary bracket' }]} style={MB}>
                          <Select placeholder="Select minimum salary tier" options={activeBrackets} onChange={onBracketSelect} />
                        </Form.Item>
                      )}
                      {selectedCard && (
                        <div style={{ background: '#f8faff', border: '1px solid #ede9fe', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {selectedCard.cardImage && (
                              <img src={`${UPLOADS_BASE}/card-images/${selectedCard.cardImage}`} alt={selectedCard.name} style={{ width: 68, height: 44, objectFit: 'contain', borderRadius: 5, border: '1px solid #dde3f5', flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: 12, color: '#1e1b4b' }}>{selectedCard.bank?.name}</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{({ regular:'Regular', premium:'Premium', rewards_lifestyle:'Rewards', travel:'Travel', ecommerce:'E-Commerce', legacy:'Legacy' })[selectedCard.cardType] || selectedCard.cardType}</div>
                              {selectedBracket?.feeType && (
                                <span style={{ display: 'inline-block', marginTop: 2, fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: feeTypeColors(selectedBracket.feeType).bg, color: feeTypeColors(selectedBracket.feeType).text, border: `1px solid ${feeTypeColors(selectedBracket.feeType).border}` }}>
                                  {feeTypeLabel(selectedBracket.feeType)}
                                </span>
                              )}
                            </div>
                          </div>
                          {selectedCard.cashbackCategories?.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                              {selectedCard.cashbackCategories.map((c, idx) => {
                                const label = c.category?.name || (typeof c.category === 'string' ? c.category : `Cat ${idx + 1}`);
                                return (
                                  <span key={c.category?._id || c.category || idx} style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
                                    {label}{c.rate != null ? ` ${c.rate}%` : ''}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Loan fields */}
                  {productType === 'loan' && (
                    <>
                      <Form.Item name="bank" label="Bank" rules={[{ required: true, message: 'Select a bank' }]} style={MB}>
                        <Select
                          loading={productsLoading} showSearch placeholder="Select bank"
                          filterOption={(input, opt) => opt.label?.toLowerCase().includes(input.toLowerCase())}
                          options={bankOptions}
                          onChange={onBankSelect}
                        />
                      </Form.Item>
                      <Form.Item name="loanProduct" label="Loan Product" rules={[{ required: true, message: 'Select a loan product' }]} style={MB}>
                        <Select
                          loading={productsLoading} showSearch placeholder={selectedBank ? 'Select loan product' : 'Select a bank first'}
                          disabled={!selectedBank}
                          filterOption={(input, opt) => opt.label?.toLowerCase().includes(input.toLowerCase())}
                          options={filteredLoanProducts.map(l => ({ value: l._id, label: l.name }))}
                          onChange={onLoanSelect}
                        />
                      </Form.Item>
                      {selectedLoan && (
                        <div style={{ background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', padding: '8px 12px', marginBottom: 8, display: 'flex', gap: 16 }}>
                          <div><div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 1 }}>Bank</div><div style={{ fontWeight: 700, fontSize: 12, color: '#1e1b4b' }}>{selectedLoan.bank?.name}</div></div>
                          <div><div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 1 }}>Category</div><div style={{ fontWeight: 700, fontSize: 12, color: '#1e1b4b' }}>{selectedLoan.loanCategory === 'mortgage' ? 'Mortgage' : 'Personal'}</div></div>
                        </div>
                      )}
                      <Form.Item name="loanAmount" label="Amount (AED)" rules={[{ required: true, message: 'Required' }]} style={MB}>
                        <InputNumber min={1} step={1000} style={{ width: '100%' }} placeholder="100000" />
                      </Form.Item>
                    </>
                  )}
                </div>

                {/* Submit */}
                <div style={{ ...panelStyle, borderTopColor: '#e2e8f0' }}>
                  {draftStatus === 'saving' && (
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8, textAlign: 'center' }}>Saving details…</div>
                  )}
                  {draftStatus === 'saved' && (
                    <div style={{ fontSize: 11, color: '#16a34a', marginBottom: 8, textAlign: 'center' }}>✓ Details saved</div>
                  )}
                  <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', margin: '0 0 12px', lineHeight: 1.65 }}>
                    By Clicking, I declare that I am a resident of UAE and holding a valid Visa and agree to the website{' '}
                    <a href="https://mysilah.ae/privacy-policy.html" target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>Privacy Policy</a>
                    {' '}and{' '}
                    <a href="https://mysilah.ae/terms.html" target="_blank" rel="noreferrer" style={{ color: '#2563eb', textDecoration: 'none' }}>Terms of Use</a>.
                  </p>
                  <Button
                    type="primary" htmlType="submit" loading={submitting} icon={<SendOutlined />} size="large"
                    style={{ width: '100%', background: 'linear-gradient(90deg,#7C3AED,#0EA5E9)', border: 'none', fontWeight: 700, boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}
                  >
                    Submit
                  </Button>
                </div>

              </div>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
