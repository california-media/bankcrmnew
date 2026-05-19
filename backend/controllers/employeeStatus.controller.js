const EmployeeStatus = require('../models/EmployeeStatus');
const Lead = require('../models/Lead');
const { createAndEmit, getAdminIds } = require('../utils/notify');

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

    const empId = req.user._id;
    const lead = await Lead.findOne({
      _id: req.params.id,
      $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }],
    });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (employeeStatusId) {
      const status = await EmployeeStatus.findOne({ _id: employeeStatusId, isActive: true });
      if (!status) return res.status(404).json({ message: 'Status not found or inactive' });
      lead.employeeStatus = employeeStatusId;
      lead.statusHistory.push({ status: 'employee_status', note: status.label, changedBy: req.user._id, changedAt: new Date() });
    } else {
      lead.employeeStatus = undefined;
      lead.statusHistory.push({ status: 'employee_status', note: 'Status cleared', changedBy: req.user._id, changedAt: new Date() });
    }

    await lead.save();
    await lead.populate('employeeStatus');
    try {
      const adminIds = await getAdminIds();
      const statusLabel = employeeStatusId
        ? (lead.employeeStatus?.label || String(employeeStatusId))
        : 'cleared';
      await createAndEmit(
        [...adminIds, String(lead.agency?._id || lead.agency), String(lead.agent?._id || lead.agent)],
        {
          type: 'employee_status_updated',
          title: 'Status Updated',
          body: `${lead.customerName} — ${statusLabel} by ${req.user.name || req.user.email}`,
          lead: lead._id,
        },
        req.user._id,
      );
    } catch (_) {}
    res.json(lead);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
