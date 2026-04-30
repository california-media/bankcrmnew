import { Typography, Card, Tag, Space } from 'antd';
import { useSelector } from 'react-redux';

function AgencyDashboard() {
  const { user } = useSelector((s) => s.auth);
  return (
    <>
      <Typography.Title level={3}>Welcome, {user.name || user.email}</Typography.Title>
      <Typography.Paragraph type="secondary">
        Lead approvals will appear here once agents start submitting leads to your agency.
      </Typography.Paragraph>
      <Card title="Your assigned banks" style={{ marginTop: 16 }}>
        <Space wrap>
          {(user.banks || []).length === 0 && <Typography.Text type="secondary">No banks assigned</Typography.Text>}
          {(user.banks || []).map((b) => (
            <Tag color="blue" key={b._id || b}>{b.name || b}</Tag>
          ))}
        </Space>
      </Card>
    </>
  );
}

export default AgencyDashboard;
