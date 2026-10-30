import { Form, Input, InputNumber, Switch } from 'antd';

// SMTP account form fields, shared by Admin → Email Settings and the
// Requests page's reply-SMTP modal. `hasPassword`: a password is already saved.
export default function SmtpSettingsFields({ hasPassword }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 10 }}>
        <Form.Item name="host" label="SMTP Host" rules={[{ required: true, message: 'Host required' }]} style={{ flex: 1, marginBottom: 10 }}>
          <Input placeholder="smtp.gmail.com" />
        </Form.Item>
        <Form.Item name="port" label="Port" rules={[{ required: true, message: 'Port required' }]} style={{ width: 110, marginBottom: 10 }}>
          <InputNumber min={1} max={65535} style={{ width: '100%' }} />
        </Form.Item>
      </div>
      <Form.Item name="secure" label="Use SSL/TLS (port 465)" valuePropName="checked" style={{ marginBottom: 10 }}>
        <Switch />
      </Form.Item>
      <Form.Item name="user" label="Username" rules={[{ required: true, message: 'Username required' }]} style={{ marginBottom: 10 }}>
        <Input placeholder="support@mysilah.ae" autoComplete="off" />
      </Form.Item>
      <Form.Item
        name="pass"
        label="Password"
        rules={hasPassword ? [] : [{ required: true, message: 'Password required' }]}
        extra={hasPassword ? 'A password is saved. Leave blank to keep it.' : undefined}
        style={{ marginBottom: 10 }}
      >
        <Input.Password placeholder={hasPassword ? '••••••••' : 'SMTP password / app password'} autoComplete="new-password" />
      </Form.Item>
      <Form.Item name="fromName" label="From Name" style={{ marginBottom: 10 }}>
        <Input placeholder="MySilah Support" />
      </Form.Item>
      <Form.Item name="fromEmail" label="From Email" rules={[{ type: 'email', message: 'Valid email required' }]} extra="Leave blank to use the username." style={{ marginBottom: 0 }}>
        <Input placeholder="support@mysilah.ae" />
      </Form.Item>
    </>
  );
}
