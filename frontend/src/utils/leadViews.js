import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// Named lead filters that dashboard cards link to (e.g. /agency/leads?view=approved).
// Each lead list page reads ?view= and ?tab= from the URL so a card lands on
// exactly the leads it counted. Keep these in step with the dashboard maths.

const monthStart = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; };

export const LEAD_VIEWS = {
  all:          { label: 'All leads',          match: () => true },
  pending:      { label: 'Awaiting action',    match: (l) => ['draft', 'submitted', 'under_review', 'assigned'].includes(l.status) },
  in_pipeline:  { label: 'In pipeline',        match: (l) => ['submitted', 'under_review', 'assigned', 'approved'].includes(l.status) },
  submitted:    { label: 'New',                match: (l) => l.status === 'submitted' },
  under_review: { label: 'Processing',         match: (l) => l.status === 'under_review' },
  approved:     { label: 'Approved / Disbursed', match: (l) => ['approved', 'disbursed'].includes(l.status) },
  approved_only:{ label: 'Approved',           match: (l) => l.status === 'approved' },
  cpv_done:     { label: 'CPV done',           match: (l) => !!l.cpvDone },
  activated:    { label: 'Activated',          match: (l) => !!l.activateDone },
  disbursed:    { label: 'Disbursed',          match: (l) => l.status === 'disbursed' },
  rejected:     { label: 'Rejected',           match: (l) => l.status === 'rejected' },
  // "This month" views for the agent's Performance This Month panel (same maths as /leads/stats).
  month_submitted: { label: 'Submitted this month', match: (l) => l.status !== 'draft' && new Date(l.createdAt) >= monthStart() },
  month_approved:  { label: 'Approved this month',  match: (l) => ['approved', 'disbursed'].includes(l.status) && new Date(l.createdAt) >= monthStart() },
  referral_pending: { label: 'Referral bonus pending', match: (l) => (l.agencyOverrideAmount || 0) > 0 && l.agencyOverrideStatus === 'pending' },
  referral_paid:    { label: 'Referral bonus paid',    match: (l) => (l.agencyOverrideAmount || 0) > 0 && l.agencyOverrideStatus === 'paid' },
};

export const getLeadView = (key) => (key && LEAD_VIEWS[key]) || null;

/**
 * URL-driven tab + view state for lead list pages.
 * ?tab=active|rejected|archive picks the starting tab; ?view=<LEAD_VIEWS key>
 * overrides the tab filter until the user clicks a tab or clears it.
 */
export function useLeadView(defaultTab = 'active') {
  const [params, setParams] = useSearchParams();
  const view = getLeadView(params.get('view'));
  const [leadsTab, setTab] = useState(params.get('tab') || defaultTab);

  const clearView = () => {
    const next = new URLSearchParams(params);
    next.delete('view');
    next.delete('tab');
    setParams(next, { replace: true });
  };
  const setLeadsTab = (t) => {
    setTab(t);
    if (view) clearView();
  };
  // Tabs highlight nothing while a view is active, since the view replaces the tab filter.
  const tabsActiveKey = view ? '__view' : leadsTab;

  return { view, leadsTab, setLeadsTab, tabsActiveKey, clearView };
}
