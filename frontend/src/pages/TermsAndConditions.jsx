import { Typography } from 'antd';

const { Title, Paragraph, Text } = Typography;

const SECTIONS = [
  {
    num: '1', title: 'Acceptance of Terms',
    content: [
      { type: 'p', text: 'By accessing or using the Inizio Global platform ("Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Platform.' },
      { type: 'p', text: 'These Terms constitute a legally binding agreement between you and Inizio Global DMCC, a company registered in the Dubai Multi Commodities Centre (DMCC), Dubai, UAE ("Inizio Global", "we", "us", or "our").' },
      { type: 'warn', text: 'Please read these Terms carefully before using the Platform. Your continued use of the Platform constitutes acceptance of any updates to these Terms.' },
    ],
  },
  {
    num: '2', title: 'Description of Services',
    content: [
      { type: 'p', text: 'Inizio Global operates a premium banking referral infrastructure platform that connects:' },
      { type: 'ul', items: [
        'Freelance banking agents seeking to refer financial products',
        'Partner agencies managing teams of referral agents',
        'Banks and financial institutions (FIs) seeking qualified leads',
      ]},
      { type: 'p', text: 'The Platform facilitates the submission, tracking, and management of financial product referrals across the UAE. Inizio Global does not itself offer, sell, or underwrite any financial products and is not a licensed financial institution.' },
    ],
  },
  {
    num: '3', title: 'Eligibility',
    content: [
      { type: 'p', text: 'To use the Platform, you must:' },
      { type: 'ul', items: [
        'Be at least 21 years of age',
        'Be a resident or registered business entity in the UAE',
        'Hold any applicable licences or permits required by UAE law for your role',
        'Not be barred from receiving services under applicable law',
      ]},
      { type: 'p', text: 'Freelance agents operating through the Platform may be required to hold a valid UAE freelance permit or equivalent authorisation. Inizio Global reserves the right to verify eligibility at any time.' },
    ],
  },
  {
    num: '4', title: 'Accounts & Registration',
    content: [
      { type: 'p', text: 'You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to:' },
      { type: 'ul', items: [
        'Provide accurate and complete registration information',
        'Update your information promptly if it changes',
        'Notify us immediately of any unauthorised use of your account',
        'Not share your credentials with any third party',
      ]},
      { type: 'p', text: 'Inizio Global reserves the right to suspend or terminate accounts that violate these Terms or engage in fraudulent activity.' },
    ],
  },
  {
    num: '5', title: 'Referral Rules',
    content: [
      { type: 'p', text: 'All referrals submitted through the Platform must comply with the following rules:' },
      { type: 'ul', items: [
        'Referrals must relate to genuine prospective customers who have provided informed consent',
        'Agents must not make misleading representations about any financial product',
        'Referrals must not duplicate leads already submitted by another agent',
        'Agents must comply with all applicable UAE Central Bank guidelines and anti-money-laundering regulations',
      ]},
      { type: 'sub', text: 'Data Accuracy' },
      { type: 'p', text: 'Agents are responsible for the accuracy of customer data submitted. Submission of false or incomplete data may result in withholding of commissions and account suspension.' },
    ],
  },
  {
    num: '6', title: 'Fees & Payments',
    content: [
      { type: 'p', text: 'Commission structures, payout schedules, and fee arrangements are governed by the specific agreement entered into between the agent or agency and Inizio Global. General terms include:' },
      { type: 'ul', items: [
        'Commissions are paid upon confirmation of a successful referral by the relevant bank or FI',
        'Payment timelines vary by product and institution, typically 30–60 days after disbursement',
        'Inizio Global may deduct applicable taxes or regulatory charges as required by UAE law',
        'Disputed commissions must be raised within 30 days of the relevant payout cycle',
      ]},
    ],
  },
  {
    num: '7', title: 'Acceptable Use & Conduct',
    content: [
      { type: 'p', text: 'You agree not to use the Platform to:' },
      { type: 'ul', items: [
        'Violate any applicable UAE law or regulation',
        'Engage in fraudulent, deceptive, or misleading conduct',
        'Harass, abuse, or harm any other user or customer',
        'Upload malicious code or attempt to compromise platform security',
        'Scrape, copy, or redistribute Platform data without written consent',
      ]},
    ],
  },
  {
    num: '8', title: 'Intellectual Property',
    content: [
      { type: 'p', text: 'All content, trademarks, logos, and software on the Platform are the property of Inizio Global or its licensors. You are granted a limited, non-exclusive, non-transferable licence to access and use the Platform for its intended purpose.' },
      { type: 'p', text: 'You may not reproduce, distribute, or create derivative works from any Platform content without prior written permission.' },
    ],
  },
  {
    num: '9', title: 'Limitation of Liability',
    content: [
      { type: 'p', text: 'To the fullest extent permitted by UAE law, Inizio Global shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Platform, including loss of profits, data, or business opportunities.' },
      { type: 'p', text: 'Our total liability to you for any claim arising under these Terms shall not exceed the total fees paid by you to Inizio Global in the three (3) months preceding the claim.' },
    ],
  },
  {
    num: '10', title: 'Termination',
    content: [
      { type: 'p', text: 'Either party may terminate access to the Platform with 30 days\' written notice. Inizio Global may terminate or suspend access immediately if you breach these Terms, engage in fraudulent activity, or if required by applicable law.' },
      { type: 'p', text: 'Upon termination, your right to use the Platform ceases immediately. Accrued commissions for confirmed referrals prior to termination will be paid per the standard schedule.' },
    ],
  },
  {
    num: '11', title: 'Governing Law',
    content: [
      { type: 'p', text: 'These Terms are governed by the laws of the Dubai International Financial Centre (DIFC). Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the DIFC Courts, Dubai, UAE.' },
    ],
  },
  {
    num: '12', title: 'Contact Us',
    content: [
      { type: 'p', text: 'For questions regarding these Terms, please contact:' },
      { type: 'ul', items: [
        'Inizio Global DMCC',
        'Meydan FZ, Dubai, United Arab Emirates',
        'Email: legal@inizioglobal.com',
      ]},
    ],
  },
];

function renderContent(item, i) {
  if (item.type === 'p') return <Paragraph key={i}>{item.text}</Paragraph>;
  if (item.type === 'warn') return (
    <div key={i} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 8 }}>
      <span>⚠️</span>
      <Text style={{ fontSize: 14 }}>{item.text}</Text>
    </div>
  );
  if (item.type === 'sub') return <Title key={i} level={5} style={{ marginTop: 16 }}>{item.text}</Title>;
  if (item.type === 'ul') return (
    <ul key={i} style={{ paddingLeft: 20, marginBottom: 16 }}>
      {item.items.map((t, j) => <li key={j} style={{ marginBottom: 6 }}><Text>{t}</Text></li>)}
    </ul>
  );
  return null;
}

function TermsAndConditions() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '40px 16px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 40, paddingBottom: 32, borderBottom: '1px solid #e2e8f0' }}>
          <img src="/logo.png" alt="Inizio Global" style={{ height: 48, width: 'auto', objectFit: 'contain', marginBottom: 24 }} />
          <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>Legal</div>
          <Title level={1} style={{ margin: '0 0 8px', fontSize: 36, fontWeight: 800 }}>Terms of Service</Title>
          <Text type="secondary">Last updated: 1 June 2026 · Effective: 1 June 2026</Text>

          {/* TOC */}
          <div style={{ marginTop: 28, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>On this page</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
              {SECTIONS.map((s) => (
                <a key={s.num} href={`#section-${s.num}`} style={{ fontSize: 13, color: '#6366f1', textDecoration: 'none' }}>
                  {s.num}. {s.title}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Sections */}
        {SECTIONS.map((s) => (
          <div key={s.num} id={`section-${s.num}`} style={{ marginBottom: 40, paddingBottom: 40, borderBottom: '1px solid #f1f5f9' }}>
            <Title level={3} style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
              {s.num}. {s.title}
            </Title>
            {s.content.map((item, i) => renderContent(item, i))}
          </div>
        ))}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>
          © 2026 Inizio Global DMCC · Built for Growth. Driven by Trust.
        </div>
      </div>
    </div>
  );
}

export default TermsAndConditions;
