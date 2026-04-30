import { Typography, Card, Row, Col } from 'antd';
import { BankOutlined, TeamOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

function AdminDashboard() {
  return (
    <>
      <Typography.Title level={3}>Welcome, Admin</Typography.Title>
      <Typography.Paragraph type="secondary">
        Manage banks and agencies. Lead/agency oversight will be added later.
      </Typography.Paragraph>
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col xs={24} md={12}>
          <Link to="/admin/banks">
            <Card hoverable>
              <BankOutlined style={{ fontSize: 32, color: '#1677ff' }} />
              <Typography.Title level={4} style={{ marginTop: 12 }}>Manage Banks</Typography.Title>
              <Typography.Paragraph type="secondary">Add or edit the banks available in the system.</Typography.Paragraph>
            </Card>
          </Link>
        </Col>
        <Col xs={24} md={12}>
          <Link to="/admin/agencies">
            <Card hoverable>
              <TeamOutlined style={{ fontSize: 32, color: '#52c41a' }} />
              <Typography.Title level={4} style={{ marginTop: 12 }}>Manage Agencies</Typography.Title>
              <Typography.Paragraph type="secondary">Invite new agencies and assign banks to them.</Typography.Paragraph>
            </Card>
          </Link>
        </Col>
      </Row>
    </>
  );
}

export default AdminDashboard;
