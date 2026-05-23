const EmployeeStatus = require('../models/EmployeeStatus');
const Lead = require('../models/Lead');
const { createAndEmit, getAdminIds } = require('../utils/notify');

/**
 * GET /api/employee-statuses  (all roles)
 */
exports.list = async (req, res) => {
  try {
    const filter = {};
    if (req.query.statusType) filter.statusType = req.query.statusType;
    const statuses = await EmployeeStatus.find(filter).sort({ order: 1, createdAt: 1 });
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
    const { label, color, statusType } = req.body;
    if (!label || !String(label).trim()) {
      return res.status(400).json({ message: 'label is required' });
    }
    const status = await EmployeeStatus.create({
      label: String(label).trim(),
      color: color ? String(color).trim() : 'default',
      statusType: statusType || 'lead_label',
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
    const { label, color, isActive, order, isDefault, isFixed } = req.body;
    const status = await EmployeeStatus.findById(req.params.id);
    if (!status) return res.status(404).json({ message: 'Status not found' });
    if (label != null) status.label = String(label).trim();
    if (color != null) status.color = String(color).trim();
    if (isActive != null) status.isActive = Boolean(isActive);
    if (order != null) status.order = Number(order);
    if (isDefault === true) {
      // Clear default from all others of the same statusType first
      await EmployeeStatus.updateMany({ statusType: status.statusType, _id: { $ne: status._id } }, { isDefault: false });
      status.isDefault = true;
    } else if (isDefault === false) {
      status.isDefault = false;
    }
    if (isFixed != null) status.isFixed = Boolean(isFixed);
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
    if (status.isFixed) return res.status(400).json({ message: 'This status is fixed and cannot be deleted.' });
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

    let lead;
    if (req.user.role === 'agency') {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    } else {
      const empId = req.user._id;
      lead = await Lead.findOne({
        _id: req.params.id,
        $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }],
      });
    }
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
    await lead.populate([
      { path: 'bank', select: 'name code' },
      { path: 'agency', select: 'name email' },
      { path: 'agent', select: 'name email' },
      { path: 'cardProduct', select: 'name cardType commissionBrackets cardImage benefits' },
      { path: 'loanProduct', select: 'name loanCategory commissionBrackets benefits' },
      { path: 'employeeStatus', select: 'label color' },
      { path: 'consentStatus', select: 'label color' },
      { path: 'assignedCpvEmployee', select: 'name email employeeType' },
      { path: 'assignedSalesEmployee', select: 'name email employeeType' },
    ]);
    try {
      const adminIds = await getAdminIds();
      const statusLabel = employeeStatusId
        ? (lead.employeeStatus?.label || String(employeeStatusId))
        : 'cleared';
      await createAndEmit(
        [...adminIds, String(lead.agency), String(lead.agent)],
        {
          type: 'employee_status_updated',
          title: 'Status Updated',
          body: `${lead.customerName} — ${statusLabel} by ${req.user.role === 'employee' ? 'Staff' : (req.user.name || req.user.email)}`,
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

/**
 * PATCH /api/leads/:id/consent-status  (employee, agency)
 * Sets the WhatsApp consent status on a lead.
 */
exports.setConsentOnLead = async (req, res) => {
  try {
    const { consentStatusId } = req.body;

    let lead;
    if (req.user.role === 'agency') {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    } else {
      const empId = req.user._id;
      lead = await Lead.findOne({
        _id: req.params.id,
        $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }],
      });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (consentStatusId) {
      const status = await EmployeeStatus.findOne({ _id: consentStatusId, statusType: 'whatsapp_consent', isActive: true });
      if (!status) return res.status(404).json({ message: 'Consent status not found or inactive' });
      lead.consentStatus = consentStatusId;
    } else {
      lead.consentStatus = undefined;
    }

    lead.consentStatusHistory = lead.consentStatusHistory || [];
    lead.consentStatusHistory.push({
      consentStatus: consentStatusId || null,
      changedBy: req.user._id,
      changedAt: new Date(),
    });

    await lead.save();
    await lead.populate([
      { path: 'bank', select: 'name code' },
      { path: 'agency', select: 'name email' },
      { path: 'agent', select: 'name email' },
      { path: 'cardProduct', select: 'name cardType commissionBrackets cardImage benefits' },
      { path: 'loanProduct', select: 'name loanCategory commissionBrackets benefits' },
      { path: 'employeeStatus', select: 'label color' },
      { path: 'consentStatus', select: 'label color' },
      { path: 'assignedCpvEmployee', select: 'name email employeeType' },
      { path: 'assignedSalesEmployee', select: 'name email employeeType' },
      { path: 'consentStatusHistory.changedBy', select: 'name email role' },
      { path: 'consentStatusHistory.consentStatus', select: 'label color' },
    ]);
    res.json(lead);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
