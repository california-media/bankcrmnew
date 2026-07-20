const User = require('../models/User');

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const genEmployeeId = async () => {
  let id, exists;
  do {
    id = 'EMP-' + Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
    exists = await User.findOne({ employeeId: id });
  } while (exists);
  return id;
};

/**
 * POST /api/employees  (agency)
 * Agency creates an employee account.
 * Body: { name, email, password }
 */
exports.create = async (req, res) => {
  try {
    const { name, email, password, employeeType } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const employeeId = await genEmployeeId();
    const employee = await User.create({
      name,
      email,
      password,
      role: 'employee',
      agency: req.user._id,
      isActive: true,
      employeeId,
      ...(employeeType && { employeeType }),
    });

    // Return sanitized user (no password)
    const sanitized = employee.toObject();
    delete sanitized.password;
    res.status(201).json(sanitized);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/employees  (agency)
 * Returns all employees that belong to this agency.
 */
exports.list = async (req, res) => {
  try {
    const employees = await User.find({ agency: req.user._id, role: 'employee' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/employees/:id/toggle  (agency)
 * Flips isActive on an employee that belongs to this agency.
 */
exports.toggleActive = async (req, res) => {
  try {
    const employee = await User.findOne({
      _id: req.params.id,
      role: 'employee',
      agency: req.user._id,
    });
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    employee.isActive = !employee.isActive;
    await employee.save();

    const sanitized = employee.toObject();
    delete sanitized.password;
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/employees/:id  (agency)
 * Update employee name and/or email.
 */
exports.update = async (req, res) => {
  try {
    const { name, email, employeeType } = req.body;
    const employee = await User.findOne({ _id: req.params.id, role: 'employee', agency: req.user._id });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    if (name) employee.name = name.trim();
    if (email) {
      const existing = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: employee._id } });
      if (existing) return res.status(409).json({ message: 'Email already in use' });
      employee.email = email.toLowerCase().trim();
    }
    if (employeeType !== undefined) employee.employeeType = employeeType;
    await employee.save();

    const sanitized = employee.toObject();
    delete sanitized.password;
    res.json(sanitized);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/employees/:id/password  (agency)
 * Set a new password for an employee.
 */
exports.updatePassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || String(password).trim().length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const employee = await User.findOne({ _id: req.params.id, role: 'employee', agency: req.user._id });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    employee.password = password;
    await employee.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /api/employees/:id  (agency)
 * Permanently remove an employee.
 */
exports.remove = async (req, res) => {
  try {
    const employee = await User.findOne({ _id: req.params.id, role: 'employee', agency: req.user._id });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    await employee.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
