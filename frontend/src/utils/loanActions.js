// Shared milestone-button labels for loan-lead action buttons — the `type`
// values map 1:1 to `PATCH /leads/:id/<type>` route segments on the backend.
export const ACTION_LABELS = {
  cpv: 'CPV',
  activate: 'Activated',
  spend: 'Spend',
  'pdc-chq': 'PDC Chq',
  'fresh-account-open': 'Account Open',
  'fresh-stl': 'STL',
  'buyout-account-open': 'Account Open',
  'buyout-ll-received': 'LL Received',
  'buyout-mc-submitted': 'MC Submitted',
  'buyout-cl-received': 'CL Received',
  'buyout-stl': 'STL',
  'sme-account-open': 'Account Open',
  'sme-buyout-account-open': 'Account Open',
  'sme-buyout-ll': 'LL',
  'sme-buyout-mc': 'MC',
  'sme-buyout-cl': 'CL',
  'pos-pdc': 'PDC',
  'pos-dda': 'DDA',
};

// Full ordered milestone list per loanType, used to render done/pending
// status pills (independent of what's actionable right now).
export const LOAN_MILESTONES = {
  pdc: [{ field: 'pdcChqDone', type: 'pdc-chq' }],
  new_stl_loan: [
    { field: 'freshAccountOpenDone', type: 'fresh-account-open' },
    { field: 'freshStlDone', type: 'fresh-stl' },
  ],
  buyout: [
    { field: 'buyoutAccountOpenDone', type: 'buyout-account-open' },
    { field: 'buyoutLlReceivedDone', type: 'buyout-ll-received' },
    { field: 'buyoutMcSubmittedDone', type: 'buyout-mc-submitted' },
    { field: 'buyoutClReceivedDone', type: 'buyout-cl-received' },
    { field: 'buyoutStlDone', type: 'buyout-stl' },
  ],
  sme_new_loan: [{ field: 'smeAccountOpenDone', type: 'sme-account-open' }],
  sme_buyout_loan: [
    { field: 'smeBuyoutAccountOpenDone', type: 'sme-buyout-account-open' },
    { field: 'smeBuyoutLlDone', type: 'sme-buyout-ll' },
    { field: 'smeBuyoutMcDone', type: 'sme-buyout-mc' },
    { field: 'smeBuyoutClDone', type: 'sme-buyout-cl' },
  ],
  pos_loan_non_bank: [
    { field: 'posPdcDone', type: 'pos-pdc' },
    { field: 'posDdaDone', type: 'pos-dda' },
  ],
};

// Per-loanType milestone flow, matching the confirmed business rules:
// - PDC: PDC Chq -> Disburse
// - New STL Fresh: Account Open AND STL (either order) -> Disburse
// - Buyout: (Account Open AND LL Received, either order) -> MC Submitted -> CL Received -> STL -> Disburse
// - SME New Loan: Account Open -> Disburse
// - SME Buyout Loan: Account Open -> LL -> MC -> CL -> Disburse (strictly sequential)
// - POS Loan / Non Bank: (PDC AND DDA, either order, shown together) -> Disburse
// - business_loan (or unset loanType): no milestone buttons, Approve/Reject only.
export function getLoanActions(row) {
  if (row.status !== 'approved') return { buttons: [], canDisburse: false };
  switch (row.loanType) {
    case 'pdc':
      return row.pdcChqDone
        ? { buttons: [], canDisburse: true }
        : { buttons: [{ type: 'pdc-chq', label: 'PDC Chq' }], canDisburse: false };
    case 'new_stl_loan': {
      if (!row.freshAccountOpenDone || !row.freshStlDone) {
        const buttons = [];
        if (!row.freshAccountOpenDone) buttons.push({ type: 'fresh-account-open', label: 'Account Open' });
        if (!row.freshStlDone) buttons.push({ type: 'fresh-stl', label: 'STL' });
        return { buttons, canDisburse: false };
      }
      return { buttons: [], canDisburse: true };
    }
    case 'buyout': {
      if (!row.buyoutAccountOpenDone || !row.buyoutLlReceivedDone) {
        const buttons = [];
        if (!row.buyoutAccountOpenDone) buttons.push({ type: 'buyout-account-open', label: 'Account Open' });
        if (!row.buyoutLlReceivedDone) buttons.push({ type: 'buyout-ll-received', label: 'LL Received' });
        return { buttons, canDisburse: false };
      }
      if (!row.buyoutMcSubmittedDone) return { buttons: [{ type: 'buyout-mc-submitted', label: 'MC Submitted' }], canDisburse: false };
      if (!row.buyoutClReceivedDone) return { buttons: [{ type: 'buyout-cl-received', label: 'CL Received' }], canDisburse: false };
      if (!row.buyoutStlDone) return { buttons: [{ type: 'buyout-stl', label: 'STL' }], canDisburse: false };
      return { buttons: [], canDisburse: true };
    }
    case 'sme_new_loan':
      return row.smeAccountOpenDone
        ? { buttons: [], canDisburse: true }
        : { buttons: [{ type: 'sme-account-open', label: 'Account Open' }], canDisburse: false };
    case 'sme_buyout_loan': {
      if (!row.smeBuyoutAccountOpenDone) return { buttons: [{ type: 'sme-buyout-account-open', label: 'Account Open' }], canDisburse: false };
      if (!row.smeBuyoutLlDone) return { buttons: [{ type: 'sme-buyout-ll', label: 'LL' }], canDisburse: false };
      if (!row.smeBuyoutMcDone) return { buttons: [{ type: 'sme-buyout-mc', label: 'MC' }], canDisburse: false };
      if (!row.smeBuyoutClDone) return { buttons: [{ type: 'sme-buyout-cl', label: 'CL' }], canDisburse: false };
      return { buttons: [], canDisburse: true };
    }
    case 'pos_loan_non_bank': {
      const buttons = [];
      if (!row.posPdcDone) buttons.push({ type: 'pos-pdc', label: 'PDC' });
      if (!row.posDdaDone) buttons.push({ type: 'pos-dda', label: 'DDA' });
      return { buttons, canDisburse: buttons.length === 0 };
    }
    default:
      return { buttons: [], canDisburse: false };
  }
}
