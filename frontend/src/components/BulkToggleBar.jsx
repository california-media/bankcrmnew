import { Button, Tooltip } from 'antd';
import { CheckCircleFilled, StopOutlined, EyeOutlined, EyeInvisibleOutlined, MessageOutlined, CloseOutlined, LoadingOutlined } from '@ant-design/icons';

// Bulk on/off bar for the admin product tables (card, loan, account).
// Shown only while rows are selected; each button sets one flag on every selected row.
const FIELDS = [
  { key: 'isActive',       label: 'Status',          on: 'Active',  off: 'Inactive', onIcon: <CheckCircleFilled />, offIcon: <StopOutlined /> },
  { key: 'agentVisible',   label: 'Agent Visible',   on: 'Visible', off: 'Hidden',   onIcon: <EyeOutlined />,       offIcon: <EyeInvisibleOutlined /> },
  { key: 'websiteVisible', label: 'Website Visible', on: 'Visible', off: 'Hidden',   onIcon: <EyeOutlined />,       offIcon: <EyeInvisibleOutlined /> },
  { key: 'sendConsent',    label: 'Send Consent',    on: 'On',      off: 'Off',      onIcon: <MessageOutlined />,   offIcon: <StopOutlined /> },
];

function ChoiceButton({ tone, icon, text, loading, disabled, onClick }) {
  const on = tone === 'on';
  const color = on ? '#7C3AED' : '#64748b';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', fontSize: 12.5, fontWeight: 600,
        border: 'none', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
        background: 'transparent', color, opacity: disabled && !loading ? 0.5 : 1,
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = on ? '#ede9fe' : '#f1f5f9'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {loading ? <LoadingOutlined /> : icon}
      {text}
    </button>
  );
}

export default function BulkToggleBar({ count, busy, onApply, onClear }) {
  if (!count) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14,
      marginBottom: 14, padding: '12px 16px',
      background: '#ffffff', border: '1px solid #e9e5ff', borderLeft: '4px solid #7C3AED',
      borderRadius: 12, boxShadow: '0 6px 20px rgba(124,58,237,0.10)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 6 }}>
        <span style={{
          minWidth: 28, height: 28, padding: '0 8px', borderRadius: 999,
          background: 'linear-gradient(135deg, #7C3AED 0%, #0EA5E9 100%)', color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13,
        }}>
          {count}
        </span>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>selected</span>
      </div>

      <div style={{ width: 1, alignSelf: 'stretch', background: '#eef0f6' }} />

      {FIELDS.map((f) => (
        <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, color: '#94a3b8', paddingLeft: 4 }}>
            {f.label}
          </span>
          <div style={{ display: 'inline-flex', gap: 2, padding: 2, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10 }}>
            <ChoiceButton tone="on" icon={f.onIcon} text={f.on} loading={busy === `${f.key}:true`} disabled={!!busy} onClick={() => onApply(f.key, true)} />
            <ChoiceButton tone="off" icon={f.offIcon} text={f.off} loading={busy === `${f.key}:false`} disabled={!!busy} onClick={() => onApply(f.key, false)} />
          </div>
        </div>
      ))}

      <Tooltip title="Clear selection">
        <Button shape="circle" size="small" icon={<CloseOutlined />} disabled={!!busy} onClick={onClear} style={{ marginLeft: 'auto' }} />
      </Tooltip>
    </div>
  );
}
