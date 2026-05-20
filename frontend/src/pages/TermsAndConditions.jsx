import { Card, Typography } from 'antd';

const { Title, Paragraph, Text } = Typography;

function TermsAndConditions() {
  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: '40px 16px' }}>
      <Card style={{ maxWidth: 800, margin: '0 auto' }}>
        <Title level={2}>Terms and Conditions</Title>
        <Paragraph type="secondary">Last updated: May 2026</Paragraph>

        <Title level={4}>1. Acceptance of Terms</Title>
        <Paragraph>
          By registering as an agent on this platform, you agree to be bound by these Terms and Conditions.
          If you do not agree, you may not use this platform.
        </Paragraph>

        <Title level={4}>2. Agent Responsibilities</Title>
        <Paragraph>
          As a registered agent, you are responsible for:
        </Paragraph>
        <ul>
          <li><Text>Providing accurate and truthful information during registration and in all submissions.</Text></li>
          <li><Text>Maintaining the confidentiality of your account credentials.</Text></li>
          <li><Text>Complying with all applicable UAE laws and regulations.</Text></li>
          <li><Text>Submitting leads only for genuine applicants who have given their consent.</Text></li>
        </ul>

        <Title level={4}>3. Data Privacy</Title>
        <Paragraph>
          All personal data submitted through this platform, including lead information and Emirates ID,
          is processed in accordance with applicable data protection laws. Data will not be shared with
          third parties without consent except as required by law.
        </Paragraph>

        <Title level={4}>4. Commission and Payments</Title>
        <Paragraph>
          Commissions are calculated based on successful lead conversions as defined by the platform
          administrator. Payment terms are subject to the rates and schedules set by the administering agency.
        </Paragraph>

        <Title level={4}>5. Prohibited Activities</Title>
        <Paragraph>
          Agents must not engage in fraudulent submissions, misrepresentation of products or services,
          or any activity that violates applicable law or platform policies. Violations may result in
          immediate account termination.
        </Paragraph>

        <Title level={4}>6. Termination</Title>
        <Paragraph>
          The platform administrator reserves the right to suspend or terminate any agent account for
          violation of these terms or for any reason deemed appropriate, with or without prior notice.
        </Paragraph>

        <Title level={4}>7. Changes to Terms</Title>
        <Paragraph>
          These terms may be updated from time to time. Continued use of the platform after changes
          constitutes acceptance of the revised terms.
        </Paragraph>

        <Title level={4}>8. Contact</Title>
        <Paragraph>
          For questions regarding these terms, contact the platform administrator.
        </Paragraph>
      </Card>
    </div>
  );
}

export default TermsAndConditions;
