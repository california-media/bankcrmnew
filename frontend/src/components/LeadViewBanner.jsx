import { Button } from 'antd';

// Shows which dashboard filter a lead list is using, with a way to clear it.
export default function LeadViewBanner({ view, count, onClear }) {
  if (!view) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '8px 14px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, fontSize: 13, color: '#4c1d95' }}>
      <span>Showing: <strong>{view.label}</strong>{typeof count === 'number' ? ` (${count})` : ''}</span>
      <Button size="small" type="link" onClick={onClear} style={{ padding: 0 }}>Clear filter</Button>
    </div>
  );
}
