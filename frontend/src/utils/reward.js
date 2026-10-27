// What the logged-in agent earns on their own lead for a commission bracket.
// A super agent submitting their own lead (no middleman) also earns the SA
// Differ: loans add agencyOverridePct (% of loan amount), cards/accounts add
// the flat agencyOverride. Loans return a %, cards/accounts an AED amount.
export const ownLeadReward = (bracket, productType, isSuperAgent) => {
  if (!bracket) return 0;
  const differ = isSuperAgent ? Number(productType === 'loan' ? bracket.agencyOverridePct : bracket.agencyOverride) || 0 : 0;
  return Math.round(((Number(bracket.payable) || 0) + differ) * 100) / 100;
};
