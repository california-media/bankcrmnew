import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Divider, Row, Col, Alert, Tooltip, Typography, Modal } from 'antd';
import { BankOutlined, LockOutlined, UserOutlined, CopyOutlined, CheckOutlined, LinkOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { updateProfile, logout } from '../../store/slices/authSlice';

function AgentSettings() {
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [profileForm] = Form.useForm();
  const [bankForm] = Form.useForm();
  const [deleteForm] = Form.useForm();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [profile, setProfile] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        payload.newPassword = values.newPassword;
      }
      const result = await dispatch(updateProfile(payload));
      if (updateProfile.rejected.match(result)) throw new Error(result.payload || 'Failed to update profile');
      message.success('Profile updated');
      profileForm.setFieldsValue({ newPassword: '', confirmPassword: '' });
    } catch (err) {
      message.error(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const confirmDelete = async (values) => {
    setDeleting(true);
    try {
      await api.delete('/auth/account', { data: { password: values.password } });
      message.success('Account deleted. Goodbye!');
      setDeleteModal(false);
      dispatch(logout());
      navigate('/login', { replace: true });
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
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
            <Col xs={24} sm={12}>
              <Form.Item
                name="newPassword"
                label="New Password"
                rules={[{ min: 6, message: 'At least 6 characters' }]}
              >
                <Input.Password placeholder="New password" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
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

      {/* Referral Link */}
      {profile?.referralCode && (
        <Card
          style={{ borderRadius: 16, border: '1px solid #e2e8f0', marginTop: 20 }}
          styles={{ header: { borderBottom: '1px solid #f1f5f9' } }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LinkOutlined style={{ color: '#7C3AED' }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Customer Referral Link</div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>Share this link with customers</div>
              </div>
            </div>
          }
        >
          <div style={{ padding: '4px 0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Your Link
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', borderRadius: 10, padding: '10px 14px', border: '1px solid #e2e8f0' }}>
              <span style={{ flex: 1, fontSize: 13, color: '#7C3AED', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {`${window.location.origin}/ref/${profile.referralCode}`}
              </span>
              <Tooltip title={copiedLink ? 'Copied!' : 'Copy link'}>
                <Button
                  size="small"
                  icon={copiedLink ? <CheckOutlined /> : <CopyOutlined />}
                  type={copiedLink ? 'primary' : 'default'}
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/ref/${profile.referralCode}`);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                />
              </Tooltip>
            </div>
          </div>
        </Card>
      )}

      {/* Danger Zone */}
      <Card
        style={{ borderRadius: 16, border: '1px solid #fecaca', marginTop: 20, background: '#fff5f5' }}
        styles={{ header: { borderBottom: '1px solid #fecaca', background: '#fff5f5' } }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <WarningOutlined style={{ color: '#dc2626' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#dc2626' }}>Danger Zone</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>Irreversible actions</div>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', marginBottom: 2 }}>Delete Account</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Permanently deactivates your account. Your submitted leads will remain in the system.
            </div>
          </div>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => { deleteForm.resetFields(); setDeleteModal(true); }}
            style={{ fontWeight: 600, borderRadius: 8, flexShrink: 0 }}
          >
            Delete My Account
          </Button>
        </div>
      </Card>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteModal}
        onCancel={() => setDeleteModal(false)}
        footer={null}
        centered
        width={420}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
            <DeleteOutlined />
            <span>Delete Account</span>
          </div>
        }
      >
        <Alert
          type="error"
          showIcon
          message="This action cannot be undone"
          description="Your account will be permanently deactivated. You will be logged out immediately."
          style={{ marginBottom: 20, borderRadius: 8 }}
        />
        <Form form={deleteForm} layout="vertical" onFinish={confirmDelete}>
          <Form.Item
            name="password"
            label={<span style={{ fontWeight: 600 }}>Confirm your password</span>}
            rules={[{ required: true, message: 'Password is required' }]}
          >
            <Input.Password placeholder="Enter your password to confirm" size="large" style={{ borderRadius: 8 }} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => setDeleteModal(false)} style={{ borderRadius: 8 }}>Cancel</Button>
            <Button
              danger
              type="primary"
              htmlType="submit"
              loading={deleting}
              icon={<DeleteOutlined />}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Yes, Delete My Account
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default AgentSettings;
