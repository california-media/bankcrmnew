const EmployeeStatus = require('../models/EmployeeStatus');
const Lead = require('../models/Lead');

/**
 * GET /api/employee-statuses  (all roles)
 */
exports.list = async (req, res) => {
  try {
    const statuses = await EmployeeStatus.find().sort({ createdAt: 1 });
    res.json(statuses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/employee-statuses  (admin)
 */
exports.create = async (req, res) => {
  try {
    const { label, color } = req.body;
    if (!label || !String(label).trim()) {
      return res.status(400).json({ message: 'label is required' });
    }
    const status = await EmployeeStatus.create({
      label: String(label).trim(),
      color: color ? String(color).trim() : 'default',
      createdBy: req.user._id,
    });
    res.status(201).json(status);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/employee-statuses/:id  (admin)
 */
exports.update = async (req, res) => {
  try {
    const { label, color, isActive } = req.body;
    const status = await EmployeeStatus.findById(req.params.id);
    if (!status) return res.status(404).json({ message: 'Status not found' });

    if (label != null) status.label = String(label).trim();
    if (color != null) status.color = String(color).trim();
    if (isActive != null) status.isActive = Boolean(isActive);
    await status.save();
    res.json(status);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /api/employee-statuses/:id  (admin)
 */
exports.remove = async (req, res) => {
  try {
    const status = await EmployeeStatus.findById(req.params.id);
    if (!status) return res.status(404).json({ message: 'Status not found' });
    await status.deleteOne();
    // Clear this status from any leads that had it
    await Lead.updateMany({ employeeStatus: req.params.id }, { $unset: { employeeStatus: 1 } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/leads/:id/employee-status  (employee)
 * Employee sets a custom status on their assigned lead.
 */
exports.setOnLead = async (req, res) => {
  try {
    const { employeeStatusId } = req.body;

    const lead = await Lead.findOne({ _id: req.params.id, assignedEmployee: req.user._id });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (employeeStatusId) {
      const status = await EmployeeStatus.findOne({ _id: employeeStatusId, isActive: true });
      if (!status) return res.status(404).json({ message: 'Status not found or inactive' });
      lead.employeeStatus = employeeStatusId;
    } else {
      lead.employeeStatus = undefined;
    }

    await lead.save();
    await lead.populate('employeeStatus');
    res.json(lead);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
