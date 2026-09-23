const mongoose = require('mongoose');
const User = require('../models/User');

const OPEN_STATUSES_EXCLUDE = ['rejected', 'disbursed'];

// For a lead just entering 'submitted' status, picks the sales employee and
// the cpv employee (independently, either may be omitted) whose assignedBanks
// includes this bank, agency-scoped. When more than one employee qualifies,
// picks whichever currently has the fewest open (non-rejected/disbursed)
// leads for that bank — a self-balancing stand-in for round-robin that needs
// no separate rotation-pointer state and self-corrects as staff change.
// Returns {} (no fields) for a type with no tagged employee — caller leaves
// that lead unassigned for manual coordinator assignment, same as today.
async function computeAutoAssignment(agencyId, bankId) {
  const result = {};
  if (!agencyId || !bankId) return result;
  const Lead = mongoose.model('Lead');

  for (const { type, field } of [
    { type: 'sales', field: 'assignedSalesEmployee' },
    { type: 'cpv', field: 'assignedCpvEmployee' },
  ]) {
    const candidates = await User.find({
      role: 'employee',
      employeeType: type,
      agency: agencyId,
      isActive: true,
      assignedBanks: bankId,
    }).select('_id').lean();
    if (!candidates.length) continue;
    if (candidates.length === 1) {
      result[field] = candidates[0]._id;
      continue;
    }

    const counts = await Lead.aggregate([
      {
        $match: {
          agency: new mongoose.Types.ObjectId(agencyId),
          bank: new mongoose.Types.ObjectId(bankId),
          [field]: { $in: candidates.map((c) => c._id) },
          status: { $nin: OPEN_STATUSES_EXCLUDE },
        },
      },
      { $group: { _id: `$${field}`, n: { $sum: 1 } } },
    ]);
    const countByEmployee = {};
    counts.forEach((c) => { countByEmployee[String(c._id)] = c.n; });
    candidates.sort((a, b) => (countByEmployee[String(a._id)] || 0) - (countByEmployee[String(b._id)] || 0));
    result[field] = candidates[0]._id;
  }

  return result;
}

module.exports = { computeAutoAssignment };
