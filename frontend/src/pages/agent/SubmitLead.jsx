import { useEffect, useState } from 'react';
import {
  Card, Form, Input, Select, Button, Typography, Row, Col, message,
  Space, InputNumber, Segmented, Descriptions, Modal, Alert,
} from 'antd';
import { ArrowLeftOutlined, CreditCardOutlined, BankOutlined, SendOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';

const aed = (n) => `AED ${Number(n || 0).toLocaleString()}`;

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0, fontWeight: 600 }}>New Lead</Typography.Title>
        <Link to="/agent/leads">
          <Button size="small" icon={<ArrowLeftOutlined />}>Back</Button>
        </Link>
      </div>

      <Form form={form} layout="vertical" size="small">
        <Row gutter={12} align="stretch">
          {/* LEFT — Client */}
          <Col xs={24} lg={14}>
            <Card
              title="Client Information"
              size="small"
              style={{ height: '100%' }}
              styles={{ body: { paddingBottom: 4 } }}
            >
              <Row gutter={[12, 0]}>
                <Col xs={24} sm={12}>
                  <Form.Item name="customerName" label="Full Name" rules={[{ required: true }]}>
                    <Input placeholder="Mohammed Ahmed" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="phone" label="Mobile Number" rules={[{ required: true }]}>
                    <Input placeholder="+971 50 xxx xxxx" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="email" label="Email">
                    <Input placeholder="client@email.com" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="nationality" label="Nationality">
                    <Select
                      showSearch allowClear placeholder="Select"
                      options={NATIONALITIES}
                      filterOption={(input, opt) => opt.label.toLowerCase().includes(input.toLowerCase())}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="visaType" label="Visa Type">
                    <Select allowClear placeholder="Select" options={VISA_OPTIONS} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="companyName" label="Company">
                    <Input placeholder="Emirates NBD" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="jobTitle" label="Job Title">
                    <Input placeholder="Sales Manager" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="yearsOfExperience" label="Experience (yrs)">
                    <InputNumber min={0} max={60} style={{ width: '100%' }} placeholder="0" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item name="notes" label="Notes" style={{ marginBottom: 4 }}>
                    <Input.TextArea rows={2} placeholder="Anything the agency should know about this client." />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* RIGHT — Product */}
          <Col xs={24} lg={10}>
            <Card
              title="Product"
              size="small"
              style={{ height: '100%' }}
              styles={{ body: { paddingBottom: 4 } }}
            >
              <Form.Item label="Type" style={{ marginBottom: 10 }}>
                <Segmented
                  value={productType}
                  onChange={onProductTypeChange}
                  size="small"
                  options={[
                    { value: 'credit_card', label: 'Credit Card', icon: <CreditCardOutlined /> },
                    { value: 'loan',        label: 'Loan',        icon: <BankOutlined /> },
                  ]}
                />
              </Form.Item>

              {productType === 'credit_card' && (
                <>
                  <Form.Item name="cardProduct" label="Card Product" rules={[{ required: true, message: 'Select a card' }]}>
                    <Select
                      loading={loading} showSearch
                      filterOption={(input, opt) => opt.searchText?.includes(input.toLowerCase())}
                      placeholder="Select card product"
                      options={cardOptions}
                      onChange={onCardSelect}
                    />
                  </Form.Item>
                  {selectedCard && (
                    <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                      {selectedCard.cardImage && (
                        <img
                          src={`${API_BASE}/uploads/card-images/${selectedCard.cardImage}`}
                          alt={selectedCard.name}
                          style={{ width: 100, height: 63, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0', flexShrink: 0 }}
                        />
                      )}
                      <Descriptions size="small" column={1} style={{ flex: 1 }}>
                        <Descriptions.Item label="Bank">{selectedCard.bank?.name}</Descriptions.Item>
                        <Descriptions.Item label="Type">
                          {({ regular: 'Regular', premium: 'Premium', rewards_lifestyle: 'Rewards', travel: 'Travel', ecommerce: 'E-Commerce', legacy: 'Legacy' })[selectedCard.cardType] || selectedCard.cardType}
                        </Descriptions.Item>
                        {selectedBracket?.feeType && (
                          <Descriptions.Item label="Fee">
                            <span style={{ fontWeight: 700, color: selectedBracket.feeType === 'free' ? '#16a34a' : '#2563eb' }}>
                              {selectedBracket.feeType === 'free' ? 'Free' : 'Paid'}
                            </span>
                          </Descriptions.Item>
                        )}
                      </Descriptions>
                    </div>
                  )}
                  {selectedCard && activeBrackets.length > 0 && (
                    <Form.Item name="salaryBracket" label="Salary Bracket" rules={[{ required: true, message: 'Select salary bracket' }]}>
                      <Select placeholder="Select minimum salary tier" options={activeBrackets} onChange={onBracketSelect} />
                    </Form.Item>
                  )}
                  {selectedBracket && (
                    <Alert type="success" showIcon style={{ marginBottom: 8, padding: '4px 10px' }}
                      message={<span style={{ fontSize: 12 }}>Payout: <strong>{aed(selectedBracket.payable)}</strong></span>}
                    />
                  )}
                </>
              )}

              {productType === 'loan' && (
                <>
                  <Form.Item name="loanProduct" label="Loan Product" rules={[{ required: true, message: 'Select a loan' }]}>
                    <Select
                      loading={loading} showSearch
                      filterOption={(input, opt) => opt.searchText?.includes(input.toLowerCase())}
                      placeholder="Select loan product"
                      options={loanOptions}
                      onChange={onLoanSelect}
                    />
                  </Form.Item>
                  {selectedLoan && (
                    <Descriptions size="small" column={2} style={{ marginBottom: 8 }}>
                      <Descriptions.Item label="Bank">{selectedLoan.bank?.name}</Descriptions.Item>
                      <Descriptions.Item label="Category">
                        {selectedLoan.loanCategory === 'mortgage' ? 'Mortgage' : 'Personal'}
                      </Descriptions.Item>
                    </Descriptions>
                  )}
                  {selectedLoan && activeBrackets.length > 0 && (
                    <Form.Item name="salaryBracket" label="Salary Bracket" rules={[{ required: true, message: 'Select salary bracket' }]}>
                      <Select placeholder="Select minimum salary tier" options={activeBrackets} onChange={onBracketSelect} />
                    </Form.Item>
                  )}
                  {selectedBracket && (
                    <Alert type="success" showIcon style={{ marginBottom: 8, padding: '4px 10px' }}
                      message={<span style={{ fontSize: 12 }}>Payout: <strong>{selectedBracket.payable}%</strong> of loan amount</span>}
                    />
                  )}
                  <Form.Item name="loanType" label="Loan Type" rules={[{ required: true, message: 'Select loan type' }]}>
                    <Select placeholder="Select loan type" options={[
                      { value: 'new_stl_loan', label: 'New STL Loan' },
                      { value: 'buyout',       label: 'Buyout' },
                      { value: 'pdc',          label: 'PDC' },
                    ]} />
                  </Form.Item>
                  <Form.Item name="loanAmount" label="Loan Amount (AED)" rules={[{ required: true, message: 'Loan amount required' }]}>
                    <InputNumber min={1} step={1000} style={{ width: '100%' }} placeholder="e.g. 100000" />
                  </Form.Item>
                </>
              )}

            </Card>
          </Col>
        </Row>

        <div style={{ marginTop: 10 }}>
          <Space>
            <Button type="primary" icon={<SendOutlined />} loading={submitting} onClick={onFormSubmit}>
              Submit Lead
            </Button>
            <Button onClick={() => { form.resetFields(); resetProduct(); }}>Reset</Button>
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
