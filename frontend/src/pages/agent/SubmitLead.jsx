import { useEffect, useState } from 'react';
import {
  Card, Form, Input, Select, Button, Typography, Row, Col, message,
  Space, InputNumber, Segmented, Descriptions, Modal, Alert,
} from 'antd';
import { ArrowLeftOutlined, CreditCardOutlined, BankOutlined, SendOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:5000';

const NATIONALITIES = [
  'Afghan', 'Albanian', 'Algerian', 'American', 'Andorran', 'Angolan', 'Antiguan',
  'Argentine', 'Armenian', 'Australian', 'Austrian', 'Azerbaijani', 'Bahamian',
  'Bahraini', 'Bangladeshi', 'Barbadian', 'Belarusian', 'Belgian', 'Belizean',
  'Beninese', 'Bhutanese', 'Bolivian', 'Bosnian', 'Botswanan', 'Brazilian',
  'British', 'Bruneian', 'Bulgarian', 'Burkinabe', 'Burundian', 'Cambodian',
  'Cameroonian', 'Canadian', 'Cape Verdean', 'Central African', 'Chadian',
  'Chilean', 'Chinese', 'Colombian', 'Comorian', 'Congolese', 'Costa Rican',
  'Croatian', 'Cuban', 'Cypriot', 'Czech', 'Danish', 'Djiboutian', 'Dominican',
  'Dutch', 'East Timorese', 'Ecuadorian', 'Egyptian', 'Emirati', 'Equatorial Guinean',
  'Eritrean', 'Estonian', 'Eswatini', 'Ethiopian', 'Fijian', 'Finnish', 'French',
  'Gabonese', 'Gambian', 'Georgian', 'German', 'Ghanaian', 'Greek', 'Grenadian',
  'Guatemalan', 'Guinean', 'Guinea-Bissauan', 'Guyanese', 'Haitian', 'Honduran',
  'Hungarian', 'Icelandic', 'Indian', 'Indonesian', 'Iranian', 'Iraqi', 'Irish',
  'Israeli', 'Italian', 'Ivorian', 'Jamaican', 'Japanese', 'Jordanian',
  'Kazakhstani', 'Kenyan', 'Kiribati', 'Korean', 'Kuwaiti', 'Kyrgyzstani',
  'Laotian', 'Latvian', 'Lebanese', 'Lesotho', 'Liberian', 'Libyan',
  'Liechtenstein', 'Lithuanian', 'Luxembourgish', 'Macedonian', 'Malagasy',
  'Malawian', 'Malaysian', 'Maldivian', 'Malian', 'Maltese', 'Marshallese',
  'Mauritanian', 'Mauritian', 'Mexican', 'Micronesian', 'Moldovan', 'Monacan',
  'Mongolian', 'Montenegrin', 'Moroccan', 'Mozambican', 'Myanmar', 'Namibian',
  'Nauruan', 'Nepali', 'New Zealander', 'Nicaraguan', 'Nigerian', 'Nigerien',
  'Norwegian', 'Omani', 'Pakistani', 'Palauan', 'Palestinian', 'Panamanian',
  'Papua New Guinean', 'Paraguayan', 'Peruvian', 'Philippine', 'Polish',
  'Portuguese', 'Qatari', 'Romanian', 'Russian', 'Rwandan', 'Salvadoran',
  'Samoan', 'Saudi Arabian', 'Senegalese', 'Serbian', 'Seychellois',
  'Sierra Leonean', 'Singaporean', 'Slovak', 'Slovenian', 'Solomon Islander',
  'Somali', 'South African', 'South Sudanese', 'Spanish', 'Sri Lankan',
  'Sudanese', 'Surinamese', 'Swedish', 'Swiss', 'Syrian', 'Taiwanese',
  'Tajikistani', 'Tanzanian', 'Thai', 'Togolese', 'Tongan', 'Trinidadian',
  'Tunisian', 'Turkish', 'Turkmenistani', 'Tuvaluan', 'Ugandan', 'Ukrainian',
  'Uruguayan', 'Uzbekistani', 'Vanuatuan', 'Venezuelan', 'Vietnamese', 'Yemeni',
  'Zambian', 'Zimbabwean',
].map((n) => ({ value: n, label: n }));

const VISA_OPTIONS = [
  { value: 'employment', label: 'Employment Visa' },
  { value: 'residence',  label: 'Residence Visa' },
  { value: 'investor',   label: 'Investor Visa' },
  { value: 'golden',     label: 'Golden Visa' },
  { value: 'freelance',  label: 'Freelance Visa' },
  { value: 'tourist',    label: 'Tourist Visa' },
  { value: 'other',      label: 'Other' },
];

const TERMS = `TERMS AND CONDITIONS FOR LEAD SUBMISSION

1. Accuracy of Information
   You confirm that all client information provided (name, phone number, salary, and product selection) is accurate and obtained with the client's knowledge and consent.

2. Client Consent
   You confirm that the client has agreed to be contacted by the agency regarding the selected financial product.

3. Data Privacy
   Client data will be used solely for processing this lead and will be handled in accordance with applicable data protection regulations.

4. No Duplicate Submissions
   You confirm this lead has not been previously submitted through this or any other channel.

5. Agent Responsibility
   You acknowledge responsibility for the quality and authenticity of the lead. Submitting false or duplicate leads may result in account suspension.

6. Commission Terms
   Commission eligibility is subject to the agency's approval and the successful disbursement of the financial product. Rates are subject to change.

7. Compliance
   This submission must comply with all applicable UAE Central Bank regulations and the agency's internal compliance policies.

By accepting these terms, you confirm all above conditions are met and authorize submission of this lead to the agency.`;

function buildBracketOptions(brackets) {
  if (!brackets || brackets.length === 0) return [];
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
              background: b.feeType === 'free' ? '#f0fdf4' : '#eff6ff',
              color: b.feeType === 'free' ? '#16a34a' : '#2563eb',
              border: `1px solid ${b.feeType === 'free' ? '#bbf7d0' : '#bfdbfe'}`,
            }}>
              {b.feeType === 'free' ? 'Free' : 'Paid'}
            </span>
          )}
        </span>
      ),
      payable: b.payable,
      feeType: b.feeType,
    }));
}

function SubmitLead() {
  const [submitting, setSubmitting]     = useState(false);
  const [productType, setProductType]   = useState('credit_card');
  const [cardProducts, setCardProducts] = useState([]);
  const [loanProducts, setLoanProducts] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [selectedBracket, setSelectedBracket] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [termsOpen, setTermsOpen]       = useState(false);
  const [pendingValues, setPendingValues] = useState(null);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get('/card-products'), api.get('/loan-products')])
      .then(([cardsRes, loansRes]) => {
        setCardProducts(cardsRes.data.filter((c) => c.isActive && c.bank?.isActive !== false));
        setLoanProducts(loansRes.data.filter((l) => l.isActive && l.bank?.isActive !== false));
      })
      .finally(() => setLoading(false));
  }, []);

  const resetProduct = () => {
    setSelectedCard(null);
    setSelectedLoan(null);
    setSelectedBracket(null);
    form.resetFields(['cardProduct', 'loanProduct', 'loanAmount', 'loanType', 'salaryBracket']);
  };

  const onProductTypeChange = (val) => { setProductType(val); resetProduct(); };

  const autoSelectMinBracket = (brackets) => {
    if (!brackets || brackets.length === 0) { setSelectedBracket(null); form.resetFields(['salaryBracket']); return; }
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

  const activeBrackets = productType === 'credit_card'
    ? buildBracketOptions(selectedCard?.commissionBrackets)
    : buildBracketOptions(selectedLoan?.commissionBrackets);

  const onFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      setPendingValues(values);
      setTermsOpen(true);
    } catch { /* validation errors shown inline */ }
  };

  const onTermsConfirm = async () => {
    setTermsOpen(false);
    setSubmitting(true);
    try {
      const values  = pendingValues;
      const payload = {
        customerName: values.customerName,
        phone:        values.phone,
        productType,
        notes:        values.notes,
      };
      if (values.salaryBracket != null) payload.customerSalary = values.salaryBracket;
      if (values.email)               payload.email             = values.email;
      if (values.nationality)         payload.nationality        = values.nationality;
      if (values.visaType)            payload.visaType           = values.visaType;
      if (values.companyName)         payload.companyName        = values.companyName;
      if (values.jobTitle)            payload.jobTitle           = values.jobTitle;
      if (values.yearsOfExperience != null) payload.yearsOfExperience = values.yearsOfExperience;
      if (productType === 'credit_card') payload.cardProduct = values.cardProduct;
      if (productType === 'loan') {
        payload.loanProduct = values.loanProduct;
        payload.loanAmount  = values.loanAmount;
        if (values.loanType) payload.loanType = values.loanType;
      }

      const { data: lead } = await api.post('/leads', payload);
      await api.post(`/leads/${lead._id}/send-to-agency`);
      message.success('Lead submitted to agency successfully.');
      navigate('/agent/leads');
    } catch (err) {
      message.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const cardOptions = cardProducts.map((c) => ({
    value: c._id,
    label: `${c.name} — ${c.bank?.name || ''}`,
    searchText: `${c.name} ${c.bank?.name || ''} ${c.cardType}`.toLowerCase(),
  }));

  const loanOptions = loanProducts.map((l) => ({
    value: l._id,
    label: `${l.name} — ${l.bank?.name || ''}`,
    searchText: `${l.name} ${l.bank?.name || ''} ${l.loanCategory}`.toLowerCase(),
  }));

  return (
    <>

      <Form form={form} layout="vertical">
        <Row gutter={12} align="stretch">
          {/* LEFT — Client */}
          <Col xs={24} lg={14}>
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8ecf4', borderTop: '3px solid #6366f1', boxShadow: '0 4px 18px rgba(99,102,241,0.08)', padding: '14px 18px', height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1e1b4b' }}>Client Information</div>
              </div>

              <Row gutter={[10, 0]}>
                <Col xs={24} sm={12}>
                  <Form.Item name="customerName" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Full Name <span style={{ color: '#ef4444' }}>*</span></span>} rules={[{ required: true, message: 'Name required' }]} style={{ marginBottom: 10 }}>
                    <Input size="middle" placeholder="Mohammed Ahmed" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="phone" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Mobile Number <span style={{ color: '#ef4444' }}>*</span></span>} rules={[{ required: true, message: 'Phone required' }]} style={{ marginBottom: 10 }}>
                    <Input size="middle" placeholder="+971 50 xxx xxxx" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="email" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Email</span>} style={{ marginBottom: 10 }}>
                    <Input size="middle" placeholder="client@email.com" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="nationality" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Nationality</span>} style={{ marginBottom: 10 }}>
                    <Select size="middle" showSearch allowClear placeholder="Select nationality" options={NATIONALITIES} filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="visaType" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Visa Type</span>} style={{ marginBottom: 10 }}>
                    <Select size="middle" allowClear placeholder="Select visa type" options={VISA_OPTIONS} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="companyName" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Company</span>} style={{ marginBottom: 10 }}>
                    <Input size="middle" placeholder="Your company" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="jobTitle" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Job Title</span>} style={{ marginBottom: 10 }}>
                    <Input size="middle" placeholder="Sales Manager" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="yearsOfExperience" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Experience (yrs)</span>} style={{ marginBottom: 10 }}>
                    <InputNumber size="middle" min={0} max={60} style={{ width: '100%', borderRadius: 8 }} placeholder="0" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item name="notes" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Notes</span>} style={{ marginBottom: 4 }}>
                    <Input.TextArea rows={2} placeholder="Anything the agency should know about this client." style={{ borderRadius: 8, resize: 'none' }} />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          </Col>

          {/* RIGHT — Product */}
          <Col xs={24} lg={10}>
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e8ecf4', borderTop: `3px solid ${productType === 'credit_card' ? '#6366f1' : '#22c55e'}`, boxShadow: `0 4px 18px ${productType === 'credit_card' ? 'rgba(99,102,241,0.08)' : 'rgba(34,197,94,0.08)'}`, padding: '14px 18px', height: '100%', transition: 'border-top-color 0.2s, box-shadow 0.2s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: productType === 'credit_card' ? '#eef2ff' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
                  {productType === 'credit_card'
                    ? <CreditCardOutlined style={{ color: '#6366f1', fontSize: 14 }} />
                    : <BankOutlined style={{ color: '#16a34a', fontSize: 14 }} />
                  }
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1e1b4b' }}>Product</div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>Type</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { value: 'credit_card', label: 'Credit Card', icon: <CreditCardOutlined />, activeColor: '#4f46e5', activeBg: '#eef2ff', activeBorder: '#6366f1' },
                    { value: 'loan',        label: 'Loan',        icon: <BankOutlined />,       activeColor: '#15803d', activeBg: '#f0fdf4', activeBorder: '#22c55e' },
                  ].map((opt) => {
                    const active = productType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onProductTypeChange(opt.value)}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          padding: '7px 10px', borderRadius: 8,
                          border: active ? `2px solid ${opt.activeBorder}` : '2px solid #e2e8f0',
                          background: active ? opt.activeBg : '#f8fafc',
                          color: active ? opt.activeColor : '#94a3b8',
                          fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer',
                          transition: 'all 0.15s',
                          boxShadow: active ? `0 2px 10px ${opt.activeBorder}35` : 'none',
                        }}
                      >
                        <span style={{ fontSize: 14 }}>{opt.icon}</span>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {productType === 'credit_card' && (
                <>
                  <Form.Item name="cardProduct" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Card Product <span style={{ color: '#ef4444' }}>*</span></span>} rules={[{ required: true, message: 'Select a card' }]} style={{ marginBottom: 10 }}>
                    <Select size="middle" loading={loading} showSearch filterOption={(input, opt) => opt.searchText?.includes(input.toLowerCase())} placeholder="Select card product" options={cardOptions} onChange={onCardSelect} />
                  </Form.Item>
                  {selectedCard && (
                    <div style={{ background: '#f8faff', borderRadius: 8, border: '1px solid #e0e7ff', padding: '8px 10px', marginBottom: 10 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {selectedCard.cardImage && (
                          <img src={`${API_BASE}/uploads/card-images/${selectedCard.cardImage}`} alt={selectedCard.name} style={{ width: 72, height: 46, objectFit: 'cover', borderRadius: 5, border: '1px solid #dde3f5', flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: '#1e1b4b' }}>{selectedCard.bank?.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{({ regular: 'Regular', premium: 'Premium', rewards_lifestyle: 'Rewards', travel: 'Travel', ecommerce: 'E-Commerce', legacy: 'Legacy' })[selectedCard.cardType] || selectedCard.cardType}</div>
                          {selectedBracket?.feeType && (
                            <span style={{ display: 'inline-block', marginTop: 3, fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: selectedBracket.feeType === 'free' ? '#f0fdf4' : '#eff6ff', color: selectedBracket.feeType === 'free' ? '#16a34a' : '#2563eb', border: `1px solid ${selectedBracket.feeType === 'free' ? '#bbf7d0' : '#bfdbfe'}` }}>
                              {selectedBracket.feeType === 'free' ? 'Free' : 'Paid'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedCard && activeBrackets.length > 0 && (
                    <Form.Item name="salaryBracket" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Salary Bracket <span style={{ color: '#ef4444' }}>*</span></span>} rules={[{ required: true, message: 'Select salary bracket' }]} style={{ marginBottom: 10 }}>
                      <Select size="middle" placeholder="Select minimum salary tier" options={activeBrackets} onChange={onBracketSelect} />
                    </Form.Item>
                  )}
                  {selectedBracket && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>Estimated Payout</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#15803d' }}>{aed(selectedBracket.payable)}</span>
                    </div>
                  )}
                </>
              )}

              {productType === 'loan' && (
                <>
                  <Form.Item name="loanProduct" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Loan Product <span style={{ color: '#ef4444' }}>*</span></span>} rules={[{ required: true, message: 'Select a loan' }]} style={{ marginBottom: 10 }}>
                    <Select size="middle" loading={loading} showSearch filterOption={(input, opt) => opt.searchText?.includes(input.toLowerCase())} placeholder="Select loan product" options={loanOptions} onChange={onLoanSelect} />
                  </Form.Item>
                  {selectedLoan && (
                    <div style={{ background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', padding: '8px 12px', marginBottom: 10, display: 'flex', gap: 16 }}>
                      <div><div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 1 }}>Bank</div><div style={{ fontWeight: 700, fontSize: 12, color: '#1e1b4b' }}>{selectedLoan.bank?.name}</div></div>
                      <div><div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 1 }}>Category</div><div style={{ fontWeight: 700, fontSize: 12, color: '#1e1b4b' }}>{selectedLoan.loanCategory === 'mortgage' ? 'Mortgage' : 'Personal'}</div></div>
                    </div>
                  )}
                  {selectedLoan && activeBrackets.length > 0 && (
                    <Form.Item name="salaryBracket" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Salary Bracket <span style={{ color: '#ef4444' }}>*</span></span>} rules={[{ required: true, message: 'Select salary bracket' }]} style={{ marginBottom: 10 }}>
                      <Select size="middle" placeholder="Select minimum salary tier" options={activeBrackets} onChange={onBracketSelect} />
                    </Form.Item>
                  )}
                  {selectedBracket && (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>Estimated Payout</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#15803d' }}>{selectedBracket.payable}% of loan</span>
                    </div>
                  )}
                  <Form.Item name="loanType" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Loan Type <span style={{ color: '#ef4444' }}>*</span></span>} rules={[{ required: true, message: 'Select loan type' }]} style={{ marginBottom: 10 }}>
                    <Select size="middle" placeholder="Select loan type" options={[
                      { value: 'new_stl_loan',  label: 'New STL Loan' },
                      { value: 'buyout',        label: 'Buyout' },
                      { value: 'pdc',           label: 'PDC' },
                      { value: 'business_loan', label: 'Business Loan' },
                    ]} />
                  </Form.Item>
                  <Form.Item name="loanAmount" label={<span style={{ fontWeight: 600, fontSize: 12, color: '#374151' }}>Loan Amount (AED) <span style={{ color: '#ef4444' }}>*</span></span>} rules={[{ required: true, message: 'Loan amount required' }]} style={{ marginBottom: 4 }}>
                    <InputNumber size="middle" min={1} step={1000} style={{ width: '100%', borderRadius: 8 }} placeholder="e.g. 100000" />
                  </Form.Item>
                </>
              )}
            </div>
          </Col>
        </Row>

        {/* Submit bar */}
        <div style={{ marginTop: 10, background: '#fff', borderRadius: 12, border: '1px solid #e8ecf4', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 10px rgba(15,23,42,0.06)' }}>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Review details before submitting.</div>
          <Space>
            <Button size="middle" onClick={() => { form.resetFields(); resetProduct(); }} style={{ borderRadius: 8 }}>Reset</Button>
            <Button
              type="primary" size="middle" icon={<SendOutlined />} loading={submitting} onClick={onFormSubmit}
              style={{ borderRadius: 8, background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', border: 'none', fontWeight: 700, paddingLeft: 20, paddingRight: 20, height: 38, boxShadow: '0 4px 14px rgba(99,102,241,0.40)' }}
            >
              Submit Lead
            </Button>
          </Space>
        </div>
      </Form>

      <Modal
        title="Terms & Conditions"
        open={termsOpen}
        onCancel={() => setTermsOpen(false)}
        onOk={onTermsConfirm}
        okText="Submit"
        cancelText="Cancel"
        okButtonProps={{ type: 'primary' }}
        width={600}
      >
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: 16, maxHeight: 320, overflowY: 'auto' }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, margin: 0, color: '#374151' }}>
            {TERMS}
          </pre>
        </div>
      </Modal>
    </>
  );
}

export default SubmitLead;
