const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Not authorized' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.isActive) return res.status(401).json({ message: 'Not authorized' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid or expired' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
};

// Lets an agency-scoped employee (Coordinator/Account Access) reach a route
// that's otherwise agency-only. The agency owner always passes through
// unchanged; an employee only passes if their employeeType is in the list —
// a plain CPV/Sales employee is still refused, exactly as before.
const allowEmployeeTypes = (...types) => (req, res, next) => {
  if (!req.user) return res.status(403).json({ message: 'Forbidden' });
  if (req.user.role === 'agency') return next();
  if (req.user.role === 'employee' && types.includes(req.user.employeeType)) return next();
  return res.status(403).json({ message: 'Forbidden' });
};

// Resolves which agency's data a request should operate on: the agency
// owner's own id, or (for an agency-scoped employee) the parent agency id
// stored on their account.
const resolveAgencyId = (user) => (user.role === 'agency' ? user._id : user.agency);

module.exports = { protect, requireRole, allowEmployeeTypes, resolveAgencyId };
