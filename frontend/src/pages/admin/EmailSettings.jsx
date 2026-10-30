import { useEffect, useState } from 'react';
import { Form, Button, Alert, Typography, Spin, message } from 'antd';
import api from '../../api/client';
import SmtpSettingsFields from '../../components/SmtpSettingsFields';

const cardStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, maxWidth: 560 };

export default function EmailSettings() {
  const [form] = Form.useForm();
  const [info, setInfo] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/email-settings')
      .then(({ data }) => { setInfo(data); form.setFieldsValue({ port: 587, ...data, pass: '' }); })
      .catch((err) => message.error(err.response?.data?.message || 'Failed to load email settings'));
  }, [form]);

  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const { data } = await api.put('/admin/email-settings', values);
      setInfo(data);
      form.setFieldsValue({ pass: '' });
      message.success('Email settings saved');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to save email settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Typography.Title level={4} style={{ marginTop: 0 }}>Email Settings</Typography.Title>
      <Typography.Paragraph type="secondary">
        The email account the website sends from: welcome emails, email verification, password resets, invites and request notifications.
        Replies on the Requests page use their own SMTP settings there.
      </Typography.Paragraph>

      <div style={cardStyle}>
        {!info ? <Spin /> : (
          <>
            {!info.configured && (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="No email account is set up yet, so the website can't send emails." />
            )}
            <Form form={form} layout="vertical">
              <SmtpSettingsFields hasPassword={info.hasPassword} />
            </Form>
            <Button type="primary" loading={saving} onClick={save} style={{ marginTop: 16 }}>Save</Button>
          </>
        )}
      </div>
    </div>
  );
}
