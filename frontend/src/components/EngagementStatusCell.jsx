import { useState } from 'react';
import { Select, message } from 'antd';
import api from '../api/client';

export const ENGAGEMENT_OPTIONS = [
  { value: 'new_lead', label: 'New Lead' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'follow_up', label: 'Follow up' },
  { value: 'focused_follow_up', label: 'Focused Follow Up' },
  { value: 'meeting_scheduled', label: 'Meeting Scheduled' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'junk', label: 'Junk' },
  { value: 'pool', label: 'Pool' },
  { value: 'closed_deal', label: 'Closed Deal' },
];

export const engagementLabel = (v) =>
  ENGAGEMENT_OPTIONS.find((o) => o.value === v)?.label || '—';

/**
 * Inline Select for the agent's per-lead engagement status. Saves on change
 * via PATCH /api/leads/:id/engagement-status.
 */
function EngagementStatusCell({ leadId, value, onChange }) {
  const [current, setCurrent] = useState(value || 'new_lead');
  const [saving, setSaving] = useState(false);

  const onSelect = async (next) => {
    const previous = current;
    setCurrent(next);
    setSaving(true);
    try {
      await api.patch(`/leads/${leadId}/engagement-status`, { engagementStatus: next });
      onChange?.(next);
    } catch (err) {
      setCurrent(previous);
      message.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Select
      size="small"
      style={{ width: 170 }}
      value={current}
      onChange={onSelect}
      loading={saving}
      options={ENGAGEMENT_OPTIONS}
    />
  );
}

export default EngagementStatusCell;
