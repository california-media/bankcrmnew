import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card, Row, Col, Avatar, Typography, Tag, Form, Input, Button,
  Space, Divider, message, Descriptions, Tooltip,
} from 'antd';
import {
  UserOutlined, MailOutlined, PhoneOutlined, CalendarOutlined,
  CopyOutlined, CheckOutlined, LockOutlined, EditOutlined, SaveOutlined, CloseOutlined,
} from '@ant-design/icons';
import { updateProfile } from '../store/slices/authSlice';
import api from '../api/client';

const ROLE_COLORS = { admin: 'red', agency: 'blue', agent: 'green', employee: 'purple' };
const ROLE_LABELS = { admin: 'Admin', agency: 'Agency', agent: 'Agent', employee: 'Employee' };

export default function Profile() {
  const dispatch = useDispatch();
  const { user: authUser } = useSelector((s) => s.auth);

  const [profile, setProfile]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingPwd, setSavingPwd]  = useState(false);
  const [copied, setCopied]        = useState(false);

  const [infoForm] = Form.useForm();
  const [pwdForm]  = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/auth/profile');
      setProfile(data.user);
    } catch {
      message.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startEdit = () => {
    infoForm.setFieldsValue({ name: profile.name, phone: profile.phone || '' });
    setEditing(true);
  };

  const cancelEdit = () => {
    infoForm.resetFields();
    setEditing(false);
  };

  const saveInfo = async () => {
    const values = await infoForm.validateFields();
    setSavingInfo(true);
    try {
      const result = await dispatch(updateProfile(values)).unwrap();
      setProfile((p) => ({ ...p, name: result.name, phone: result.phone }));
      message.success('Profile updated');
      setEditing(false);
    } catch (err) {
      message.error(err || 'Update failed');
    } finally {
      setSavingInfo(false);
    }
  };

  const savePassword = async () => {
    const values = await pwdForm.validateFields();
    if (values.newPassword !== values.confirmPassword) {
      message.error('Passwords do not match');
      return;
    }
    setSavingPwd(true);
    try {
      await dispatch(updateProfile({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })).unwrap();
      message.success('Password changed');
      pwdForm.resetFields();
    } catch (err) {
      message.error(err || 'Password change failed');
    } finally {
      setSavingPwd(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(profile.referralCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !profile) {
    return <Card loading style={{ maxWidth: 800, margin: '0 auto' }} />;
  }

  const initials = (profile.name || profile.email || '?')[0].toUpperCase();
  const role = profile.role;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>

      {/* Header card */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={24} align="middle">
          <Col>
            <Avatar
              size={80}
              style={{ backgroundColor: '#1677ff', fontSize: 32, fontWeight: 700 }}
            >
              {initials}
            </Avatar>
          </Col>
          <Col flex="auto">
            <Space direction="vertical" size={4}>
              <Space align="center">
                <Typography.Title level={4} style={{ margin: 0, fontWeight: 500 }}>
                  {profile.name || '—'}
                </Typography.Title>
                <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Tag>
                <Tag color={profile.isActive ? 'green' : 'default'}>
                  {profile.isActive ? 'Active' : 'Inactive'}
                </Tag>
              </Space>
              <Space size={16}>
                <Typography.Text type="secondary">
                  <MailOutlined style={{ marginRight: 4 }} />{profile.email}
                </Typography.Text>
                {profile.phone && (
                  <Typography.Text type="secondary">
                    <PhoneOutlined style={{ marginRight: 4 }} />{profile.phone}
                  </Typography.Text>
                )}
                <Typography.Text type="secondary">
                  <CalendarOutlined style={{ marginRight: 4 }} />
                  Joined {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </Typography.Text>
              </Space>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={24}>
        <Col xs={24} lg={14}>

          {/* Edit info */}
          <Card
            title="Profile Information"
            extra={
              editing ? null : (
                <Button icon={<EditOutlined />} type="text" onClick={startEdit}>Edit</Button>
              )
            }
            style={{ marginBottom: 24 }}
          >
            {editing ? (
              <Form form={infoForm} layout="vertical">
                <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Name is required' }]}>
                  <Input prefix={<UserOutlined />} placeholder="Your name" />
                </Form.Item>
                <Form.Item name="phone" label="Phone">
                  <Input prefix={<PhoneOutlined />} placeholder="+971 50 000 0000" />
                </Form.Item>
                <Space>
                  <Button type="primary" icon={<SaveOutlined />} loading={savingInfo} onClick={saveInfo}>
                    Save Changes
                  </Button>
                  <Button icon={<CloseOutlined />} onClick={cancelEdit}>Cancel</Button>
                </Space>
              </Form>
            ) : (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Full Name">{profile.name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Email">{profile.email}</Descriptions.Item>
                <Descriptions.Item label="Phone">{profile.phone || '—'}</Descriptions.Item>
                <Descriptions.Item label="Role">
                  <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Joined">
                  {new Date(profile.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                </Descriptions.Item>
              </Descriptions>
            )}
          </Card>

          {/* Change password */}
          <Card title="Change Password">
            <Form form={pwdForm} layout="vertical">
              <Form.Item
                name="currentPassword"
                label="Current Password"
                rules={[{ required: true, message: 'Enter current password' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Current password" />
              </Form.Item>
              <Form.Item
                name="newPassword"
                label="New Password"
                rules={[{ required: true, min: 6, message: 'At least 6 characters' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="New password" />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="Confirm New Password"
                rules={[{ required: true, message: 'Confirm your new password' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Repeat new password" />
              </Form.Item>
              <Button type="primary" loading={savingPwd} onClick={savePassword}>
                Update Password
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={10}>

          {/* Role-specific info */}
          {role === 'agent' && (
            <Card title="Agent Details" style={{ marginBottom: 24 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Lead Count">{profile.leadCount ?? 0}</Descriptions.Item>
                {profile.referredBy && (
                  <Descriptions.Item label="Referred By">
                    {profile.referredBy.name || profile.referredBy.email}
                    {profile.referredBy.referralCode && (
                      <Typography.Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                        ({profile.referredBy.referralCode})
                      </Typography.Text>
                    )}
                  </Descriptions.Item>
                )}
              </Descriptions>
              {profile.referralCode && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Your Referral Code
                  </Typography.Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <Typography.Text
                      code
                      style={{ fontSize: 18, letterSpacing: 3, fontWeight: 700, flex: 1, textAlign: 'center' }}
                    >
                      {profile.referralCode}
                    </Typography.Text>
                    <Tooltip title={copied ? 'Copied!' : 'Copy code'}>
                      <Button
                        icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                        type={copied ? 'primary' : 'default'}
                        onClick={copyCode}
                      />
                    </Tooltip>
                  </div>
                  <Typography.Text type="secondary" style={{ fontSize: 11, marginTop: 6, display: 'block' }}>
                    Share this code so other agents can join under you.
                  </Typography.Text>
                </>
              )}
            </Card>
          )}

          {role === 'employee' && profile.agency && (
            <Card title="Agency" style={{ marginBottom: 24 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Name">{profile.agency.name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Email">{profile.agency.email}</Descriptions.Item>
                {profile.agency.phone && (
                  <Descriptions.Item label="Phone">{profile.agency.phone}</Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          )}

          {/* Account status card */}
          <Card title="Account Status">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Status">
                <Tag color={profile.isActive ? 'green' : 'default'}>
                  {profile.isActive ? 'Active' : 'Inactive'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Role">
                <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Member Since">
                {new Date(profile.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
