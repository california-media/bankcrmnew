import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Row, Col, Avatar, Tag, Form, Input, Button,
  Space, Divider, message, Tooltip,
} from 'antd';
import {
  UserOutlined, MailOutlined, PhoneOutlined, CalendarOutlined,
  CopyOutlined, CheckOutlined, LockOutlined, EditOutlined, SaveOutlined,
  CloseOutlined, BankOutlined, IdcardOutlined, LinkOutlined,
} from '@ant-design/icons';
import { updateProfile } from '../store/slices/authSlice';
import api from '../api/client';

const ROLE_BG    = { admin: '#7c3aed', agency: '#1e40af', agent: '#4f46e5', employee: '#b45309' };
const ROLE_LIGHT = { admin: '#ede9fe', agency: '#dbeafe', agent: '#e0e7ff', employee: '#fef3c7' };
const ROLE_TEXT  = { admin: '#7c3aed', agency: '#1e40af', agent: '#4f46e5', employee: '#b45309' };
const ROLE_LABELS = { admin: 'Admin', agency: 'Agency', agent: 'Agent', employee: 'Employee' };

const Section = ({ children, style }) => (
  <div style={{
    background: '#fff',
    borderRadius: 14,
    border: '1px solid #e0e2f7',
    boxShadow: '0 2px 12px rgba(99,102,241,0.07), 0 1px 3px rgba(99,102,241,0.04)',
    marginBottom: 20,
    overflow: 'hidden',
    ...style,
  }}>
    {children}
  </div>
);

const SectionHeader = ({ title, action }) => (
  <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{title}</span>
    {action}
  </div>
);

const InfoRow = ({ icon, label, value }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid #f8fafc' }}>
    <span style={{ color: '#94a3b8', fontSize: 15, width: 20, flexShrink: 0 }}>{icon}</span>
    <span style={{ fontSize: 12, color: '#94a3b8', width: 110, flexShrink: 0 }}>{label}</span>
    <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{value || '—'}</span>
  </div>
);

export default function Profile() {
  const dispatch = useDispatch();
  const { user: authUser } = useSelector((s) => s.auth);

  const [profile, setProfile]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [editing, setEditing]         = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [savingInfo, setSavingInfo]   = useState(false);
  const [savingPwd, setSavingPwd]     = useState(false);
  const [savingBank, setSavingBank]   = useState(false);
  const [copied, setCopied]           = useState(false);
  const [copiedLink, setCopiedLink]   = useState(false);

  const [infoForm] = Form.useForm();
  const [pwdForm]  = Form.useForm();
  const [bankForm] = Form.useForm();

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
    infoForm.setFieldsValue({ name: profile.name, phone: profile.phone || '', emiratesId: profile.emiratesId || '' });
    setEditing(true);
  };
  const cancelEdit = () => { infoForm.resetFields(); setEditing(false); };

  const saveInfo = async () => {
    const values = await infoForm.validateFields();
    setSavingInfo(true);
    try {
      const result = await dispatch(updateProfile(values)).unwrap();
      setProfile((p) => ({ ...p, name: result.name, phone: result.phone, emiratesId: result.emiratesId }));
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
    if (values.newPassword !== values.confirmPassword) { message.error('Passwords do not match'); return; }
    setSavingPwd(true);
    try {
      await dispatch(updateProfile({ newPassword: values.newPassword })).unwrap();
      message.success('Password changed');
      pwdForm.resetFields();
    } catch (err) {
      message.error(err || 'Password change failed');
    } finally {
      setSavingPwd(false);
    }
  };

  const startEditBank = () => {
    bankForm.setFieldsValue({
      accountHolderName: profile.bankDetails?.accountHolderName || '',
      bankName: profile.bankDetails?.bankName || '',
      accountNumber: profile.bankDetails?.accountNumber || '',
      iban: profile.bankDetails?.iban || '',
      swiftCode: profile.bankDetails?.swiftCode || '',
    });
    setEditingBank(true);
  };
  const cancelEditBank = () => { bankForm.resetFields(); setEditingBank(false); };

  const saveBank = async () => {
    const values = await bankForm.validateFields();
    setSavingBank(true);
    try {
      const { data } = await api.patch('/auth/profile', { bankDetails: values });
      setProfile((p) => ({ ...p, bankDetails: data.user.bankDetails }));
      message.success('Bank details updated');
      setEditingBank(false);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setSavingBank(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(profile.referralCode || '');
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/ref/${profile.referralCode}`);
    setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading || !profile) {
    return <div style={{ maxWidth: 860, margin: '0 auto', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Loading…</div>;
  }

  const initials = (profile.name || profile.email || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const role = profile.role;
  const bd = profile.bankDetails || {};
  const hasBankDetails = bd.accountHolderName || bd.bankName || bd.accountNumber || bd.iban;
  const avatarBg = ROLE_BG[role] || '#4f46e5';

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* Hero header */}
      <div style={{
        background: `linear-gradient(135deg, ${avatarBg}18 0%, #e0e7ff44 100%)`,
        border: '1px solid #e0e2f7',
        borderRadius: 16,
        padding: '28px 28px 24px',
        marginBottom: 20,
        boxShadow: '0 2px 12px rgba(99,102,241,0.07)',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
      }}>
        <Avatar
          size={72}
          style={{ background: `linear-gradient(135deg, ${avatarBg}, ${avatarBg}cc)`, fontSize: 26, fontWeight: 800, flexShrink: 0, boxShadow: `0 4px 16px ${avatarBg}44` }}
        >
          {initials}
        </Avatar>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 20, color: '#0f172a' }}>{profile.name || '—'}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: ROLE_TEXT[role], background: ROLE_LIGHT[role], borderRadius: 999, padding: '3px 10px', border: `1px solid ${ROLE_TEXT[role]}22` }}>
              {ROLE_LABELS[role]}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: profile.isActive ? '#15803d' : '#64748b', background: profile.isActive ? '#f0fdf4' : '#f1f5f9', borderRadius: 999, padding: '3px 10px', border: `1px solid ${profile.isActive ? '#86efac' : '#e2e8f0'}` }}>
              {profile.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
              <MailOutlined style={{ fontSize: 12 }} />{profile.email}
            </span>
            {profile.phone && (
              <span style={{ fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
                <PhoneOutlined style={{ fontSize: 12 }} />{profile.phone}
              </span>
            )}
            <span style={{ fontSize: 13, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5 }}>
              <CalendarOutlined style={{ fontSize: 12 }} />
              Joined {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      <Row gutter={20}>
        <Col xs={24} lg={14}>

          {/* Profile info */}
          <Section>
            <SectionHeader
              title="Profile Information"
              action={!editing && <Button size="small" icon={<EditOutlined />} type="text" onClick={startEdit} style={{ color: '#6366f1' }}>Edit</Button>}
            />
            {editing ? (
              <div style={{ padding: 20 }}>
                <Form form={infoForm} layout="vertical">
                  <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
                    <Input prefix={<UserOutlined style={{ color: '#94a3b8' }} />} placeholder="Your name" />
                  </Form.Item>
                  <Form.Item name="phone" label="Phone">
                    <Input prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />} placeholder="+971 50 000 0000" />
                  </Form.Item>
                  <Form.Item name="emiratesId" label="Emirates ID">
                    <Input prefix={<IdcardOutlined style={{ color: '#94a3b8' }} />} placeholder="784-XXXX-XXXXXXX-X" />
                  </Form.Item>
                  <Space>
                    <Button type="primary" icon={<SaveOutlined />} loading={savingInfo} onClick={saveInfo}>Save</Button>
                    <Button icon={<CloseOutlined />} onClick={cancelEdit}>Cancel</Button>
                  </Space>
                </Form>
              </div>
            ) : (
              <div>
                <InfoRow icon={<UserOutlined />}    label="Full Name"   value={profile.name} />
                <InfoRow icon={<MailOutlined />}    label="Email"       value={profile.email} />
                <InfoRow icon={<PhoneOutlined />}   label="Phone"       value={profile.phone} />
                <InfoRow icon={<IdcardOutlined />}  label="Emirates ID" value={profile.emiratesId} />
              </div>
            )}
          </Section>

          {/* Bank details — agents only */}
          {role === 'agent' && (
            <Section>
              <SectionHeader
                title={<span><BankOutlined style={{ marginRight: 6, color: '#6366f1' }} />Bank Details</span>}
                action={!editingBank && <Button size="small" icon={<EditOutlined />} type="text" onClick={startEditBank} style={{ color: '#6366f1' }}>Edit</Button>}
              />
              {editingBank ? (
                <div style={{ padding: 20 }}>
                  <Form form={bankForm} layout="vertical">
                    <Form.Item name="accountHolderName" label="Account Holder Name">
                      <Input placeholder="As per bank records" />
                    </Form.Item>
                    <Form.Item name="bankName" label="Bank Name">
                      <Input placeholder="e.g. Emirates NBD" />
                    </Form.Item>
                    <Form.Item name="accountNumber" label="Account Number">
                      <Input placeholder="Account number" />
                    </Form.Item>
                    <Form.Item name="iban" label="IBAN">
                      <Input placeholder="AE000000000000000000000" />
                    </Form.Item>
                    <Form.Item name="swiftCode" label="SWIFT / BIC Code">
                      <Input placeholder="e.g. EBILAEAD" />
                    </Form.Item>
                    <Space>
                      <Button type="primary" icon={<SaveOutlined />} loading={savingBank} onClick={saveBank}>Save</Button>
                      <Button icon={<CloseOutlined />} onClick={cancelEditBank}>Cancel</Button>
                    </Space>
                  </Form>
                </div>
              ) : hasBankDetails ? (
                <div>
                  <InfoRow icon={<UserOutlined />} label="Account Holder" value={bd.accountHolderName} />
                  <InfoRow icon={<BankOutlined />} label="Bank"           value={bd.bankName} />
                  <InfoRow icon={<IdcardOutlined />} label="Account No."  value={bd.accountNumber} />
                  <InfoRow icon={<IdcardOutlined />} label="IBAN"         value={bd.iban} />
                  <InfoRow icon={<IdcardOutlined />} label="SWIFT"        value={bd.swiftCode} />
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <BankOutlined style={{ fontSize: 32, color: '#c7d2fe', marginBottom: 10 }} />
                  <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>No bank details added yet</div>
                  <Button type="dashed" icon={<EditOutlined />} onClick={startEditBank}>Add Bank Details</Button>
                </div>
              )}
            </Section>
          )}

        </Col>

        <Col xs={24} lg={10}>

          {/* Agent details + referral */}
          {role === 'agent' && (
            <Section>
              <SectionHeader title="Agent Details" />
              <div>
                {profile.referredBy && (
                  <InfoRow icon={<UserOutlined />} label="Referred By" value={profile.referredBy.name || profile.referredBy.email} />
                )}
              </div>
              {profile.referralCode && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                    Customer Referral Link
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', borderRadius: 10, padding: '9px 12px', border: '1px solid #e2e8f0' }}>
                    <LinkOutlined style={{ color: '#6366f1', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: '#4f46e5', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {`${window.location.origin}/ref/${profile.referralCode}`}
                    </span>
                    <Tooltip title={copiedLink ? 'Copied!' : 'Copy link'}>
                      <Button
                        size="small"
                        icon={copiedLink ? <CheckOutlined /> : <CopyOutlined />}
                        type={copiedLink ? 'primary' : 'default'}
                        onClick={copyLink}
                      />
                    </Tooltip>
                  </div>
                </div>
              )}
            </Section>
          )}

          {role === 'employee' && profile.agency && (
            <Section>
              <SectionHeader title="Agency" />
              <InfoRow icon={<UserOutlined />}  label="Name"  value={profile.agency.name} />
              <InfoRow icon={<MailOutlined />}  label="Email" value={profile.agency.email} />
              {profile.agency.phone && <InfoRow icon={<PhoneOutlined />} label="Phone" value={profile.agency.phone} />}
            </Section>
          )}

          {role !== 'agent' && (
            <Section>
              <SectionHeader title="Account Status" />
              <InfoRow icon={<UserOutlined />}    label="Status" value={<Tag color={profile.isActive ? 'green' : 'default'}>{profile.isActive ? 'Active' : 'Inactive'}</Tag>} />
              <InfoRow icon={<IdcardOutlined />}  label="Role"   value={<Tag color="purple">{ROLE_LABELS[role]}</Tag>} />
              <InfoRow icon={<CalendarOutlined />} label="Member Since" value={new Date(profile.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })} />
            </Section>
          )}

          {/* Change password */}
          <Section>
            <SectionHeader title={<span><LockOutlined style={{ marginRight: 6, color: '#6366f1' }} />Change Password</span>} />
            <div style={{ padding: 20 }}>
              <Form form={pwdForm} layout="vertical">
                <Form.Item name="newPassword" label="New Password" rules={[{ required: true, min: 6, message: 'At least 6 characters' }]}>
                  <Input.Password prefix={<LockOutlined style={{ color: '#94a3b8' }} />} placeholder="New password" />
                </Form.Item>
                <Form.Item name="confirmPassword" label="Confirm New Password" rules={[{ required: true, message: 'Confirm your new password' }]}>
                  <Input.Password prefix={<LockOutlined style={{ color: '#94a3b8' }} />} placeholder="Repeat new password" />
                </Form.Item>
                <Button type="primary" loading={savingPwd} onClick={savePassword} icon={<LockOutlined />}>
                  Update Password
                </Button>
              </Form>
            </div>
          </Section>

        </Col>
      </Row>
    </div>
  );
}
