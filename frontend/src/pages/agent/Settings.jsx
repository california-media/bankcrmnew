import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Divider, Row, Col, Alert } from 'antd';
import { BankOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import api from '../../api/client';
import { updateProfile } from '../../store/slices/authSlice';

function AgentSettings() {
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const [profileForm] = Form.useForm();
  const [bankForm] = Form.useForm();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    api.get('/auth/profile').then((res) => {
      const u = res.data.user;
      setProfile(u);
      profileForm.setFieldsValue({ name: u.name, phone: u.phone });
      if (u.bankDetails) {
        bankForm.setFieldsValue({
          accountHolderName: u.bankDetails.accountHolderName || '',
          bankName: u.bankDetails.bankName || '',
          accountNumber: u.bankDetails.accountNumber || '',
          iban: u.bankDetails.iban || '',
          swiftCode: u.bankDetails.swiftCode || '',
        });
      }
    });
  }, []);

  const bankLocked = !!(profile?.bankDetails?.iban || profile?.bankDetails?.accountNumber);

  const saveProfile = async (values) => {
    setSavingProfile(true);
    try {
      const payload = { name: values.name, phone: values.phone };
      if (values.newPassword) {
        payload.currentPassword = values.currentPassword;
        payload.newPassword = values.newPassword;
      }
      const result = await dispatch(updateProfile(payload));
      if (updateProfile.rejected.match(result)) throw new Error(result.payload || 'Failed to update profile');
      message.success('Profile updated');
      profileForm.setFieldsValue({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      message.error(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveBank = async (values) => {
    setSavingBank(true);
    try {
      const result = await dispatch(updateProfile({ bankDetails: values }));
      if (updateProfile.rejected.match(result)) throw new Error(result.payload || 'Failed to save bank details');
      message.success('Bank details saved');
    } catch (err) {
      message.error(err.message || 'Failed to save bank details');
    } finally {
      setSavingBank(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 24 }}>Settings</div>

      {/* Bank Details */}
      <Card
        style={{ borderRadius: 16, border: '1px solid #e2e8f0', marginBottom: 20 }}
        styles={{ header: { borderBottom: '1px solid #f1f5f9' } }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BankOutlined style={{ color: '#3b82f6' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Bank Details</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>Used for commission payouts</div>
            </div>
          </div>
        }
      >
        {bankLocked ? (
          <>
            <Alert
              type="warning"
              showIcon
              icon={<LockOutlined />}
              message="Bank details are locked after first submission. Contact admin to update."
              style={{ marginBottom: 16, borderRadius: 8 }}
            />
            {[
              { label: 'Account Holder Name', value: profile.bankDetails?.accountHolderName },
              { label: 'Bank Name', value: profile.bankDetails?.bankName },
              { label: 'Account Number', value: profile.bankDetails?.accountNumber },
              { label: 'IBAN', value: profile.bankDetails?.iban },
              { label: 'SWIFT / BIC Code', value: profile.bankDetails?.swiftCode },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: value ? '#0f172a' : '#94a3b8' }}>{value || 'Not provided'}</div>
              </div>
            ))}
          </>
        ) : (
          <Form form={bankForm} layout="vertical" onFinish={saveBank} requiredMark={false}>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item name="accountHolderName" label="Account Holder Name">
                  <Input placeholder="Full name as on bank account" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="bankName" label="Bank Name">
                  <Input placeholder="e.g. Emirates NBD" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item name="accountNumber" label="Account Number">
                  <Input placeholder="Account number" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="iban" label="IBAN">
                  <Input placeholder="AE00 0000 0000 0000 0000 000" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="swiftCode" label="SWIFT / BIC Code" style={{ maxWidth: 260 }}>
              <Input placeholder="e.g. EBILAEAD" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={savingBank} style={{ borderRadius: 8, fontWeight: 600 }}>
              Save Bank Details
            </Button>
          </Form>
        )}
      </Card>

      {/* Profile */}
      <Card
        style={{ borderRadius: 16, border: '1px solid #e2e8f0' }}
        styles={{ header: { borderBottom: '1px solid #f1f5f9' } }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserOutlined style={{ color: '#16a34a' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Profile</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>Name, phone, and password</div>
            </div>
          </div>
        }
      >
        <Form
          form={profileForm}
          layout="vertical"
          onFinish={saveProfile}
          requiredMark={false}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Name required' }]}>
                <Input placeholder="Your name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="phone" label="Phone">
                <Input placeholder="+971 50 000 0000" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ fontSize: 12, color: '#94a3b8' }}>
            <LockOutlined /> Change Password
          </Divider>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="currentPassword" label="Current Password">
                <Input.Password placeholder="Current password" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="newPassword"
                label="New Password"
                rules={[{ min: 6, message: 'At least 6 characters' }]}
              >
                <Input.Password placeholder="New password" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="confirmPassword"
                label="Confirm Password"
                dependencies={['newPassword']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                      return Promise.reject('Passwords do not match');
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="Confirm password" />
              </Form.Item>
            </Col>
          </Row>

          <Button type="primary" htmlType="submit" loading={savingProfile} style={{ borderRadius: 8, fontWeight: 600 }}>
            Save Profile
          </Button>
        </Form>
      </Card>
    </div>
  );
}

export default AgentSettings;
