export const FEE_TYPE_LABELS = {
  free: 'Free',
  paid: 'Paid',
  free_tnc: 'Free*(T&C)',
};

export const FEE_TYPE_COLORS = {
  free: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0', tag: 'green' },
  paid: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe', tag: 'blue' },
  free_tnc: { bg: '#fffbeb', text: '#b45309', border: '#fde68a', tag: 'gold' },
};

export const feeTypeLabel = (feeType) => FEE_TYPE_LABELS[feeType] || feeType;

export const feeTypeColors = (feeType) => FEE_TYPE_COLORS[feeType] || FEE_TYPE_COLORS.paid;
