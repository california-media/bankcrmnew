const Lead = require('../models/Lead');
const Bank = require('../models/Bank');
const User = require('../models/User');
const CardProduct = require('../models/CardProduct');
const LoanProduct = require('../models/LoanProduct');
const EmployeeStatus = require('../models/EmployeeStatus');
const AgencyPayout = require('../models/AgencyPayout');
const commissionService = require('../services/commission.service');
const { createAndEmit, getAdminIds, formatStatus } = require('../utils/notify');
const waba = require('../services/waba.service');
const { getFilename } = require('../middleware/upload.middleware');
const XLSX = require('xlsx');

const normalizePhone = (p) => {
  const c = String(p).replace(/[\s\-\+\(\)\.]/g, '');
  return /^0/.test(c) ? '971' + c.slice(1) : c;
};
const isValidUAEPhone = (p) => /^9715\d{8}$/.test(normalizePhone(p));

const POPULATE_FIELDS = [
  { path: 'bank', select: 'name code hasSpend' },
  { path: 'agency', select: 'name email' },
  { path: 'agent', select: 'name email' },
  { path: 'cardProduct', select: 'name cardType commissionBrackets cashbackCategories cardImage benefits feesEligibility', populate: { path: 'cashbackCategories.category', select: 'name' } },
  { path: 'loanProduct', select: 'name loanCategory commissionBrackets benefits feesEligibility minSalary maxLoanAmount maxTenure interestRateRange' },
  { path: 'employeeStatus', select: 'label color' },
  { path: 'consentStatus',  select: 'label color' },
  { path: 'loanStatus',     select: 'label color' },
  { path: 'assignedCpvEmployee', select: 'name email employeeType' },
  { path: 'assignedSalesEmployee', select: 'name email employeeType' },
];

/**
 * POST /api/leads  (agent)
 * Body: { customerName, phone, productType, cardProduct?, loanProduct?, loanAmount?, notes? }
 * Bank and agency are derived from the selected card/loan product.
 */
exports.create = async (req, res) => {
  try {
    const { customerName, phone, productType, cardProduct, loanProduct, loanAmount, loanType, customerSalary, notes, email, visaType, nationality, city, companyName, jobTitle, yearsOfExperience, referenceNo } = req.body;
    if (!customerName || !phone || !productType) {
      return res.status(400).json({ message: 'customerName, phone, and productType are required' });
    }
    if (!isValidUAEPhone(phone)) {
      return res.status(400).json({ message: 'Invalid UAE mobile number. Must be 12 digits starting with 9715 (e.g. 971501234567 or 0501234567)' });
    }

    let bankId, agencyId;

    if (productType === 'credit_card') {
      if (!cardProduct) return res.status(400).json({ message: 'cardProduct is required for credit card leads' });
      const card = await CardProduct.findById(cardProduct).populate('agency', 'isActive role');
      if (!card) return res.status(400).json({ message: 'Invalid card product' });
      if (!card.isActive) return res.status(400).json({ message: 'This card product is not active' });
      bankId = card.bank;
      if (card.agency && card.agency.role === 'agency' && card.agency.isActive) {
        agencyId = card.agency._id;
      } else {
        agencyId = req.user.agency;
      }
      if (!agencyId) return res.status(400).json({ message: 'This card product has no agency assigned. Ask an admin to edit the product and select an agency.' });
    } else if (productType === 'loan') {
      if (!loanProduct) return res.status(400).json({ message: 'loanProduct is required for loan leads' });
      if (!loanAmount || loanAmount <= 0) return res.status(400).json({ message: 'loanAmount is required for loan leads' });
      const loan = await LoanProduct.findById(loanProduct).populate('agency', 'isActive role');
      if (!loan) return res.status(400).json({ message: 'Invalid loan product' });
      if (!loan.isActive) return res.status(400).json({ message: 'This loan product is not active' });
      bankId = loan.bank;
      if (loan.agency && loan.agency.role === 'agency' && loan.agency.isActive) {
        agencyId = loan.agency._id;
      } else {
        agencyId = req.user.agency;
      }
      if (!agencyId) return res.status(400).json({ message: 'This loan product has no agency assigned. Ask an admin to edit the product and select an agency.' });
    } else {
      return res.status(400).json({ message: 'productType must be credit_card or loan' });
    }

    const leadData = {
      customerName,
      phone,
      productType,
      bank: bankId,
      agency: agencyId,
      notes,
      agent: req.user._id,
      status: 'draft',
    };
    if (customerSalary != null) leadData.customerSalary = customerSalary;
    if (referenceNo) leadData.referenceNo = referenceNo.trim();
    if (email) leadData.email = email.trim();
    if (visaType) leadData.visaType = visaType.trim();
    if (nationality) leadData.nationality = nationality.trim();
    if (city) leadData.city = city.trim();
    if (companyName) leadData.companyName = companyName.trim();
    if (jobTitle) leadData.jobTitle = jobTitle.trim();
    if (yearsOfExperience != null) leadData.yearsOfExperience = yearsOfExperience;
    if (productType === 'credit_card') leadData.cardProduct = cardProduct;
    if (productType === 'loan') { leadData.loanProduct = loanProduct; leadData.loanAmount = loanAmount; if (loanType) leadData.loanType = loanType; }

    // Pre-calculate expected commissions from product brackets at creation time
    const { receivable, payable } = await commissionService.resolveCommissions({
      productType,
      cardProduct,
      loanProduct,
      loanAmount,
      customerSalary,
    });
    leadData.grossCommission = receivable;
    leadData.commission = payable;

    const agentDoc = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { leadCount: 1 } },
      { new: true, select: 'leadCount' }
    );
    const agentShortId = String(req.user._id).slice(-6).toUpperCase();
    const seq = String(agentDoc.leadCount).padStart(4, '0');
    leadData.leadNumber = `LD-${agentShortId}-${seq}`;

    const newLeadStatus = await EmployeeStatus.findOne({ label: /^new lead$/i, statusType: 'lead_label', isActive: true });
    if (newLeadStatus) leadData.employeeStatus = newLeadStatus._id;
    const sentConsent = await EmployeeStatus.findOne({ label: /^sent$/i, statusType: 'whatsapp_consent', isActive: true });
    if (sentConsent) leadData.consentStatus = sentConsent._id;

    const lead = await Lead.create(leadData);
    const populated = await lead.populate(POPULATE_FIELDS);

    // Send WhatsApp consent message — fire and forget, never block lead creation
    waba.sendConsentMessage({ phone: lead.phone, externalLeadId: lead.leadNumber || lead._id, customerName: lead.customerName })
      .then((r) => { if (r.error || r.skipped) console.log('[WABA]', r); })
      .catch(() => {});

    try {
      const adminIds = await getAdminIds();
      const productName = populated.productType === 'credit_card'
        ? (populated.cardProduct?.name || 'Card')
        : (populated.loanProduct?.name || 'Loan');
      await createAndEmit(
        [...adminIds, String(populated.agency?._id || populated.agency)],
        {
          type: 'lead_created',
          title: 'New Lead',
          body: `${lead.customerName} — ${populated.bank?.name || ''} ${productName}`,
          lead: lead._id,
        },
        req.user._id,
      );
    } catch (_) {}
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/leads/:id/send-to-agency  (agent, admin)
 */
exports.sendToAgency = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user.role === 'agent') filter.agent = req.user._id;
    const lead = await Lead.findOne(filter);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (lead.status !== 'draft') {
      return res.status(400).json({ message: 'Only draft leads can be sent' });
    }
    if (!lead.agency || !lead.bank) {
      return res.status(400).json({ message: 'Lead is missing bank or agency' });
    }

    const agencyDoc = await User.findOne({ _id: lead.agency, role: 'agency', isActive: true });
    if (!agencyDoc) return res.status(400).json({ message: 'The target agency is no longer active' });

    lead.status = 'submitted';

    // Auto-assign consent status: "Sent" label first, then isDefault, then lowest order
    let defaultConsent = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', label: /^sent$/i, isActive: true });
    if (!defaultConsent) defaultConsent = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', isDefault: true, isActive: true });
    if (!defaultConsent) defaultConsent = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', isActive: true }).sort({ order: 1, createdAt: 1 });
    if (defaultConsent && !lead.consentStatus) lead.consentStatus = defaultConsent._id;

    // Auto-assign lead label: "New Lead" first, then isDefault, then lowest order
    let defaultLabel = await EmployeeStatus.findOne({ statusType: 'lead_label', label: /^new lead$/i, isActive: true });
    if (!defaultLabel) defaultLabel = await EmployeeStatus.findOne({ statusType: 'lead_label', isDefault: true, isActive: true });
    if (!defaultLabel) defaultLabel = await EmployeeStatus.findOne({ statusType: 'lead_label', isActive: true }).sort({ order: 1, createdAt: 1 });
    if (defaultLabel && !lead.employeeStatus) lead.employeeStatus = defaultLabel._id;

    await lead.save();

    const populated = await lead.populate(POPULATE_FIELDS);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /api/leads/:id  (agent)
 */
exports.removeDraft = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, agent: req.user._id });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (lead.status !== 'draft') {
      return res.status(400).json({ message: 'Only draft leads can be deleted' });
    }
    await lead.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/leads/mine  (agent)
 */
exports.listMine = async (req, res) => {
  try {
    const leads = await Lead.find({ agent: req.user._id })
      .populate('bank', 'name code hasSpend')
      .populate('agency', 'name email')
      .populate('cardProduct', 'name cardType commissionBrackets')
      .populate('loanProduct', 'name loanCategory commissionBrackets')
      .populate('employeeStatus', 'label color')
      .populate('consentStatus', 'label color')
      .populate('consentStatusHistory.consentStatus', 'label color')
      .populate('consentStatusHistory.changedBy', 'name email')
      .sort({ updatedAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/leads/stats  (agent)
 */
exports.stats = async (req, res) => {
  try {
    const agentId = req.user._id;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [total, approved, rejected, disbursed, cpvDoneCount, activateDoneCount, leads, monthPaidLeads] = await Promise.all([
      Lead.countDocuments({ agent: agentId }),
      Lead.countDocuments({ agent: agentId, status: 'approved' }),
      Lead.countDocuments({ agent: agentId, status: 'rejected' }),
      Lead.countDocuments({ agent: agentId, status: 'disbursed' }),
      Lead.countDocuments({ agent: agentId, cpvDone: true }),
      Lead.countDocuments({ agent: agentId, activateDone: true }),
      Lead.find({ agent: agentId }).select('status commission commissionStatus createdAt'),
      Lead.find({ agent: agentId, commissionStatus: 'paid', commissionPaidAt: { $gte: monthStart } }).select('commission'),
    ]);

    const activeStatuses = ['draft', 'submitted', 'under_review', 'assigned'];
    const active = leads.filter((l) => activeStatuses.includes(l.status)).length;
    const drafts = leads.filter((l) => l.status === 'draft').length;
    const submitted = leads.filter((l) => l.status === 'submitted').length;
    const underReview = leads.filter((l) => l.status === 'under_review').length;
    const assigned = leads.filter((l) => l.status === 'assigned').length;
    const pending = submitted + underReview;
    const paidEarnings = leads
      .filter((l) => l.commissionStatus === 'paid')
      .reduce((s, l) => s + (l.commission || 0), 0);
    const pendingEarnings = leads
      .filter((l) => l.commissionStatus === 'pending' || l.commissionStatus === 'payable')
      .reduce((s, l) => s + (l.commission || 0), 0);

    const thisMonthLeads = leads.filter((l) => new Date(l.createdAt) >= monthStart);
    const thisMonthSubmitted = thisMonthLeads.filter((l) => l.status !== 'draft').length;
    const thisMonthApproved = thisMonthLeads.filter((l) => l.status === 'approved' || l.status === 'disbursed').length;
    const thisMonthPaid = monthPaidLeads.length;
    const thisMonthEarned = monthPaidLeads.reduce((s, l) => s + (l.commission || 0), 0);

    res.json({
      total, active, drafts, submitted, underReview, assigned,
      approved, rejected, pending, disbursed,
      cpvDone: cpvDoneCount, activateDone: activateDoneCount,
      paidEarnings, pendingEarnings,
      thisMonth: { submitted: thisMonthSubmitted, approved: thisMonthApproved, paid: thisMonthPaid, earned: thisMonthEarned },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/leads/agency  (agency)
 */
exports.listForAgency = async (req, res) => {
  try {
    const leads = await Lead.find({ agency: req.user._id, status: { $ne: 'draft' } })
      .populate('bank', 'name code hasSpend')
      .populate('agent', 'name email')
      .populate('assignedEmployee', 'name email')
      .populate('assignedCpvEmployee', 'name email employeeType')
      .populate('assignedSalesEmployee', 'name email employeeType')
      .populate('employeeStatus', 'label color')
      .populate('consentStatus', 'label color')
      .populate('cardProduct', 'name cardType commissionBrackets')
      .populate('loanProduct', 'name loanCategory commissionBrackets')
      .populate('consentStatusHistory.consentStatus', 'label color')
      .populate('consentStatusHistory.changedBy', 'name email')
      .sort({ updatedAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/leads  (admin)
 */
exports.listAll = async (req, res) => {
  try {
    const leads = await Lead.find()
      .populate('bank', 'name code hasSpend')
      .populate('agent', 'name email')
      .populate('agency', 'name email')
      .populate('assignedEmployee', 'name email')
      .populate('assignedCpvEmployee', 'name email employeeType')
      .populate('assignedSalesEmployee', 'name email employeeType')
      .populate('employeeStatus', 'label color')
      .populate('consentStatus', 'label color')
      .populate('cardProduct', 'name cardType commissionBrackets')
      .populate('loanProduct', 'name loanCategory commissionBrackets')
      .populate('consentStatusHistory.consentStatus', 'label color')
      .populate('consentStatusHistory.changedBy', 'name email')
      .sort({ updatedAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const FROM_STATES = {
  under_review: ['submitted'],
  assigned: ['under_review'],
  approved: ['submitted', 'under_review', 'assigned'],
  rejected: ['submitted', 'under_review', 'assigned', 'approved'],
  disbursed: ['approved'],
};

const ROLE_TARGETS = {
  agency: ['under_review', 'assigned', 'approved', 'rejected', 'disbursed'],
  admin: ['under_review', 'assigned', 'approved', 'rejected', 'disbursed', 'submitted'],
  employee: ['approved', 'disbursed', 'rejected'],
};

/**
 * PATCH /api/leads/:id/status  (agency, admin)
 */
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !Lead.STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const allowed = ROLE_TARGETS[req.user.role];
    if (!allowed || !allowed.includes(status)) {
      return res.status(403).json({ message: 'You may not set this status' });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (req.user.role === 'agency') {
      if (!lead.agency || String(lead.agency) !== String(req.user._id)) {
        return res.status(403).json({ message: 'This lead is not assigned to you' });
      }
    }
    if (req.user.role === 'employee') {
      const empId = String(req.user._id);
      const isAssigned =
        String(lead.assignedEmployee || '') === empId ||
        String(lead.assignedCpvEmployee || '') === empId ||
        String(lead.assignedSalesEmployee || '') === empId;
      if (!isAssigned) {
        return res.status(403).json({ message: 'This lead is not assigned to you' });
      }
    }

    const allowedFrom = FROM_STATES[status];
    if (allowedFrom && !allowedFrom.includes(lead.status)) {
      return res.status(400).json({
        message: `Cannot move from "${lead.status}" to "${status}"`,
      });
    }

    lead.status = status;
    lead.statusHistory.push({
      status,
      note: req.body.note ? String(req.body.note).trim() : undefined,
      changedBy: req.user._id,
      changedAt: new Date(),
    });
    await commissionService.recalcOnStatusChange(lead);
    // Auto-update lead label to match system status
    const labelMap = { approved: 'Approved', rejected: 'Rejected', disbursed: 'Disbursed' };
    if (labelMap[status]) {
      const lbl = await EmployeeStatus.findOne({ label: labelMap[status], statusType: 'lead_label', isActive: true });
      if (lbl) lead.employeeStatus = lbl._id;
    }
    await lead.save();

    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const statusRecipients = [
        ...adminIds,
        String(populated.agency?._id || populated.agency),
        String(populated.agent?._id || populated.agent),
      ];
      if (populated.assignedCpvEmployee) statusRecipients.push(String(populated.assignedCpvEmployee?._id || populated.assignedCpvEmployee));
      if (populated.assignedSalesEmployee) statusRecipients.push(String(populated.assignedSalesEmployee?._id || populated.assignedSalesEmployee));
      await createAndEmit(
        statusRecipients,
        {
          type: 'status_changed',
          title: { approved: 'Application Approved', disbursed: 'Application Disbursed', rejected: 'Application Rejected' }[status] || `Lead ${formatStatus(status)}`,
          body: `${lead.customerName} — ${populated.bank?.name || ''}`,
          lead: lead._id,
        },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/leads/:id/loan-amount  (agency)
 * Agency can edit the loan amount before the lead is approved.
 */
exports.updateLoanAmount = async (req, res) => {
  try {
    const { loanAmount } = req.body;
    if (!loanAmount || loanAmount <= 0) {
      return res.status(400).json({ message: 'loanAmount must be a positive number' });
    }

    const lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (lead.productType !== 'loan') {
      return res.status(400).json({ message: 'This lead is not a loan lead' });
    }
    const preLockStatuses = ['submitted', 'under_review', 'assigned', 'approved'];
    if (!preLockStatuses.includes(lead.status)) {
      return res.status(400).json({ message: 'Loan amount can only be edited before disbursement' });
    }

    lead.loanAmount = loanAmount;

    // Recalculate commission based on new loan amount (only if not yet locked by disbursement)
    if (lead.status !== 'disbursed') {
      const { receivable, payable } = await commissionService.resolveCommissions(lead);
      lead.grossCommission = receivable;
      lead.commission = payable;
    }

    await lead.save();

    const populated = await lead.populate(POPULATE_FIELDS);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/leads/:id/cpv  (agency)
 * Mark CPV (Credit Profile Verification) done with optional note.
 */
exports.updateCpv = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.cpvDone = true;
    const cpvNote = req.body.note ? String(req.body.note).trim() : undefined;
    if (cpvNote) lead.cpvNote = cpvNote;
    lead.statusHistory.push({ status: 'cpv_done', note: cpvNote, changedBy: req.user._id, changedAt: new Date() });
    const cpvLbl = await EmployeeStatus.findOne({ label: /^cpv$/i, statusType: 'lead_label', isActive: true });
    if (cpvLbl) lead.employeeStatus = cpvLbl._id;
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const cpvRecipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      if (populated.assignedCpvEmployee) cpvRecipients.push(String(populated.assignedCpvEmployee?._id || populated.assignedCpvEmployee));
      await createAndEmit(
        cpvRecipients,
        { type: 'cpv_done', title: 'CPV Completed', body: `${lead.customerName} — CPV completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/leads/:id/activate  (agency)
 * Mark Activate done with optional note. Advances status to assigned.
 */
exports.updateActivate = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.activateDone = true;
    const activateNote = req.body.note ? String(req.body.note).trim() : undefined;
    if (activateNote) lead.activateNote = activateNote;
    lead.statusHistory.push({ status: 'activate_done', note: activateNote, changedBy: req.user._id, changedAt: new Date() });
    const activateLbl = await EmployeeStatus.findOne({ label: /^activated?$/i, statusType: 'lead_label', isActive: true });
    if (activateLbl) lead.employeeStatus = activateLbl._id;
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const activateRecipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      if (populated.assignedSalesEmployee) activateRecipients.push(String(populated.assignedSalesEmployee?._id || populated.assignedSalesEmployee));
      await createAndEmit(
        activateRecipients,
        { type: 'activate_done', title: 'Activation Completed', body: `${lead.customerName} — Activation completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/leads/:id/spend  (agency + employee)
 * Mark Spend done with optional note.
 */
exports.updateSpend = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.spendDone = true;
    const spendNote = req.body.note ? String(req.body.note).trim() : undefined;
    if (spendNote) lead.spendNote = spendNote;
    lead.statusHistory.push({ status: 'spend_done', note: spendNote, changedBy: req.user._id, changedAt: new Date() });
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      await createAndEmit(
        recipients,
        { type: 'spend_done', title: 'Spend Completed', body: `${lead.customerName} — Spend completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updatePdcChq = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.pdcChqDone = true;
    const note = req.body.note ? String(req.body.note).trim() : undefined;
    if (note) lead.pdcChqNote = note;
    lead.statusHistory.push({ status: 'pdc_chq_done', note, changedBy: req.user._id, changedAt: new Date() });
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      await createAndEmit(
        recipients,
        { type: 'pdc_chq_done', title: 'PDC Chq Completed', body: `${lead.customerName} — PDC Chq completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateFreshAccountOpen = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.freshAccountOpenDone = true;
    const note = req.body.note ? String(req.body.note).trim() : undefined;
    if (note) lead.freshAccountOpenNote = note;
    lead.statusHistory.push({ status: 'fresh_account_open_done', note, changedBy: req.user._id, changedAt: new Date() });
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      await createAndEmit(
        recipients,
        { type: 'fresh_account_open_done', title: 'Account Open Completed', body: `${lead.customerName} — Account Open completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateFreshStl = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.freshStlDone = true;
    const note = req.body.note ? String(req.body.note).trim() : undefined;
    if (note) lead.freshStlNote = note;
    lead.statusHistory.push({ status: 'fresh_stl_done', note, changedBy: req.user._id, changedAt: new Date() });
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      await createAndEmit(
        recipients,
        { type: 'fresh_stl_done', title: 'STL Completed', body: `${lead.customerName} — STL completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateBuyoutAccountOpen = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.buyoutAccountOpenDone = true;
    const note = req.body.note ? String(req.body.note).trim() : undefined;
    if (note) lead.buyoutAccountOpenNote = note;
    lead.statusHistory.push({ status: 'buyout_account_open_done', note, changedBy: req.user._id, changedAt: new Date() });
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      await createAndEmit(
        recipients,
        { type: 'buyout_account_open_done', title: 'Account Open Completed', body: `${lead.customerName} — Account Open completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateBuyoutLlReceived = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.buyoutLlReceivedDone = true;
    const note = req.body.note ? String(req.body.note).trim() : undefined;
    if (note) lead.buyoutLlReceivedNote = note;
    lead.statusHistory.push({ status: 'buyout_ll_received_done', note, changedBy: req.user._id, changedAt: new Date() });
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      await createAndEmit(
        recipients,
        { type: 'buyout_ll_received_done', title: 'LL Received Completed', body: `${lead.customerName} — LL Received completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateBuyoutMcSubmitted = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.buyoutMcSubmittedDone = true;
    const note = req.body.note ? String(req.body.note).trim() : undefined;
    if (note) lead.buyoutMcSubmittedNote = note;
    lead.statusHistory.push({ status: 'buyout_mc_submitted_done', note, changedBy: req.user._id, changedAt: new Date() });
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      await createAndEmit(
        recipients,
        { type: 'buyout_mc_submitted_done', title: 'MC Submitted Completed', body: `${lead.customerName} — MC Submitted completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateBuyoutClReceived = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.buyoutClReceivedDone = true;
    const note = req.body.note ? String(req.body.note).trim() : undefined;
    if (note) lead.buyoutClReceivedNote = note;
    lead.statusHistory.push({ status: 'buyout_cl_received_done', note, changedBy: req.user._id, changedAt: new Date() });
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      await createAndEmit(
        recipients,
        { type: 'buyout_cl_received_done', title: 'CL Received Completed', body: `${lead.customerName} — CL Received completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateBuyoutStl = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.buyoutStlDone = true;
    const note = req.body.note ? String(req.body.note).trim() : undefined;
    if (note) lead.buyoutStlNote = note;
    lead.statusHistory.push({ status: 'buyout_stl_done', note, changedBy: req.user._id, changedAt: new Date() });
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      await createAndEmit(
        recipients,
        { type: 'buyout_stl_done', title: 'STL Completed', body: `${lead.customerName} — STL completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateSmeAccountOpen = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.smeAccountOpenDone = true;
    const note = req.body.note ? String(req.body.note).trim() : undefined;
    if (note) lead.smeAccountOpenNote = note;
    lead.statusHistory.push({ status: 'sme_account_open_done', note, changedBy: req.user._id, changedAt: new Date() });
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      await createAndEmit(
        recipients,
        { type: 'sme_account_open_done', title: 'Account Open Completed', body: `${lead.customerName} — Account Open completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateSmeBuyoutAccountOpen = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.smeBuyoutAccountOpenDone = true;
    const note = req.body.note ? String(req.body.note).trim() : undefined;
    if (note) lead.smeBuyoutAccountOpenNote = note;
    lead.statusHistory.push({ status: 'sme_buyout_account_open_done', note, changedBy: req.user._id, changedAt: new Date() });
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      await createAndEmit(
        recipients,
        { type: 'sme_buyout_account_open_done', title: 'Account Open Completed', body: `${lead.customerName} — Account Open completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateSmeBuyoutLl = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.smeBuyoutLlDone = true;
    const note = req.body.note ? String(req.body.note).trim() : undefined;
    if (note) lead.smeBuyoutLlNote = note;
    lead.statusHistory.push({ status: 'sme_buyout_ll_done', note, changedBy: req.user._id, changedAt: new Date() });
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      await createAndEmit(
        recipients,
        { type: 'sme_buyout_ll_done', title: 'LL Completed', body: `${lead.customerName} — LL completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateSmeBuyoutMc = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.smeBuyoutMcDone = true;
    const note = req.body.note ? String(req.body.note).trim() : undefined;
    if (note) lead.smeBuyoutMcNote = note;
    lead.statusHistory.push({ status: 'sme_buyout_mc_done', note, changedBy: req.user._id, changedAt: new Date() });
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      await createAndEmit(
        recipients,
        { type: 'sme_buyout_mc_done', title: 'MC Completed', body: `${lead.customerName} — MC completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateSmeBuyoutCl = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.smeBuyoutClDone = true;
    const note = req.body.note ? String(req.body.note).trim() : undefined;
    if (note) lead.smeBuyoutClNote = note;
    lead.statusHistory.push({ status: 'sme_buyout_cl_done', note, changedBy: req.user._id, changedAt: new Date() });
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      await createAndEmit(
        recipients,
        { type: 'sme_buyout_cl_done', title: 'CL Completed', body: `${lead.customerName} — CL completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updatePosPdc = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.posPdcDone = true;
    const note = req.body.note ? String(req.body.note).trim() : undefined;
    if (note) lead.posPdcNote = note;
    lead.statusHistory.push({ status: 'pos_pdc_done', note, changedBy: req.user._id, changedAt: new Date() });
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      await createAndEmit(
        recipients,
        { type: 'pos_pdc_done', title: 'PDC Completed', body: `${lead.customerName} — PDC completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updatePosDda = async (req, res) => {
  try {
    let lead;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      lead = await Lead.findOne({ _id: req.params.id, $or: [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }] });
    } else {
      lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    }
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.posDdaDone = true;
    const note = req.body.note ? String(req.body.note).trim() : undefined;
    if (note) lead.posDdaNote = note;
    lead.statusHistory.push({ status: 'pos_dda_done', note, changedBy: req.user._id, changedAt: new Date() });
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(populated.agent?._id || populated.agent)];
      await createAndEmit(
        recipients,
        { type: 'pos_dda_done', title: 'DDA Completed', body: `${lead.customerName} — DDA completed`, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/leads/:id/agent-commission  (admin)
 * Admin sets how much commission the agent receives.
 * Body: { agentCommissionType: 'percentage'|'fixed', agentCommissionValue: number }
 */
exports.setAgentCommission = async (req, res) => {
  try {
    const { agentCommissionType, agentCommissionValue } = req.body;
    if (!agentCommissionType || agentCommissionValue == null) {
      return res.status(400).json({ message: 'agentCommissionType and agentCommissionValue are required' });
    }
    if (!['percentage', 'fixed'].includes(agentCommissionType)) {
      return res.status(400).json({ message: 'agentCommissionType must be percentage or fixed' });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (lead.status !== 'approved') {
      return res.status(400).json({ message: 'Agent commission can only be adjusted before disbursement (approved stage only)' });
    }

    lead.agentCommissionType = agentCommissionType;
    lead.agentCommissionValue = agentCommissionValue;

    if (agentCommissionType === 'percentage') {
      lead.commission = (lead.grossCommission * agentCommissionValue) / 100;
    } else {
      lead.commission = agentCommissionValue;
    }

    if (lead.commissionStatus === 'none') lead.commissionStatus = 'pending';
    await lead.save();

    const populated = await lead.populate(POPULATE_FIELDS);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/leads/:id/mark-paid  (admin)
 * Sends payout to agent and records a snapshot in payoutHistory.
 */
exports.markCommissionPaid = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (lead.commissionStatus !== 'payable') {
      return res.status(400).json({ message: 'Commission is not payable' });
    }
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Hold amount: credit card only, based on holdPct from request
    const holdPct = Math.min(100, Math.max(0, Number(req.body.holdPct) || 0));
    let holdAmount = 0;
    if (lead.productType === 'credit_card' && holdPct > 0) {
      holdAmount = Math.round(lead.commission * holdPct / 100);
      const card = await CardProduct.findById(lead.cardProduct).select('clawbackMonths clawbackDays');
      const clawbackDays = card?.clawbackDays || (card?.clawbackMonths ? card.clawbackMonths * 30 : 90);
      if (clawbackDays > 0) {
        const until = new Date(now);
        until.setDate(until.getDate() + clawbackDays);
        lead.clawbackUntil = until;
      }
      lead.holdAmount = holdAmount;
    }

    lead.payoutHistory.push({
      amount: lead.commission - holdAmount,
      sentAt: now,
      sentBy: req.user._id,
      month,
    });
    lead.commissionStatus = 'paid';
    lead.commissionPaidAt = now;
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      const body = holdAmount > 0
        ? `${lead.customerName} — AED ${Number(lead.commission - holdAmount).toLocaleString()} paid · AED ${Number(holdAmount).toLocaleString()} on hold`
        : `${lead.customerName} — AED ${Number(lead.commission || 0).toLocaleString()} commission paid`;
      await createAndEmit(
        [String(populated.agent?._id || populated.agent)],
        { type: 'commission_paid', title: 'Commission Paid', body, lead: lead._id },
        req.user._id,
      );
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/leads/holds  (admin)
 * List all credit-card leads with an active (unreleased) hold amount.
 */
exports.listHolds = async (req, res) => {
  try {
    const leads = await Lead.find({ holdAmount: { $gt: 0 }, holdReleased: { $ne: true }, productType: 'credit_card' })
      .populate(POPULATE_FIELDS)
      .sort({ commissionPaidAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/leads/bulk-release-holds  (admin)
 * Body: { leadIds?: string[] }  — omit to release all active holds.
 */
exports.bulkReleaseHolds = async (req, res) => {
  try {
    const { leadIds } = req.body;
    const query = { holdAmount: { $gt: 0 }, holdReleased: { $ne: true } };
    if (leadIds && leadIds.length) query._id = { $in: leadIds };

    const leads = await Lead.find(query);
    if (!leads.length) return res.json({ count: 0, message: 'No active holds found' });

    const now = new Date();
    await Lead.updateMany(
      { _id: { $in: leads.map((l) => l._id) } },
      { holdReleased: true, holdReleasedAt: now },
    );

    // Notify each affected agent
    await Promise.allSettled(
      leads.map((lead) =>
        createAndEmit(
          [String(lead.agent)],
          {
            type: 'hold_released',
            title: 'Hold Released',
            body: `${lead.customerName} — AED ${Number(lead.holdAmount || 0).toLocaleString()} hold released`,
            lead: lead._id,
          },
          req.user._id,
        )
      )
    );

    res.json({ count: leads.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/leads/:id/release-hold  (admin)
 * Release the held amount back to the agent.
 */
exports.releaseHold = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (!lead.holdAmount || lead.holdReleased) return res.status(400).json({ message: 'No active hold on this lead' });

    lead.holdReleased = true;
    lead.holdReleasedAt = new Date();
    await lead.save();

    try {
      await createAndEmit(
        [String(lead.agent)],
        {
          type: 'hold_released',
          title: 'Hold Released',
          body: `${lead.customerName} — AED ${Number(lead.holdAmount || 0).toLocaleString()} hold released`,
          lead: lead._id,
        },
        req.user._id,
      );
    } catch (_) {}

    const populated = await lead.populate(POPULATE_FIELDS);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/leads/:id/receipt  (agency)
 * Agency attaches a disbursement receipt reference to a disbursed lead.
 */
exports.addDisbursementReceipt = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (lead.status !== 'disbursed') {
      return res.status(400).json({ message: 'Receipt can only be added to disbursed leads' });
    }

    const { receipt } = req.body;
    const hasFile = !!req.file;
    if (!receipt && !hasFile) {
      return res.status(400).json({ message: 'Provide a reference number or upload a file' });
    }

    if (receipt) lead.disbursementReceipt = String(receipt).trim();
    if (hasFile) lead.disbursementReceiptFile = getFilename(req.file);
    lead.disbursementReceiptAt = new Date();
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/leads/bulk-mark-paid  (admin)
 * Body: { leadIds?: string[] }  — omit for all payable leads
 */
exports.bulkMarkPaid = async (req, res) => {
  try {
    const { leadIds, holdPct: rawHoldPct } = req.body;
    const holdPct = Math.min(100, Math.max(0, Number(rawHoldPct) || 0));

    const filter = leadIds?.length
      ? { _id: { $in: leadIds }, commissionStatus: 'payable' }
      : { commissionStatus: 'payable' };
    const leads = await Lead.find(filter);
    if (!leads.length) return res.status(400).json({ message: 'No payable leads found' });
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Pre-fetch clawbackMonths from card products (only needed if holdPct > 0)
    let cardClawbackMap = {};
    if (holdPct > 0) {
      const cardIds = [...new Set(leads.filter((l) => l.productType === 'credit_card' && l.cardProduct).map((l) => String(l.cardProduct)))];
      const cards = await CardProduct.find({ _id: { $in: cardIds } }).select('clawbackMonths clawbackDays');
      cardClawbackMap = Object.fromEntries(cards.map((c) => [String(c._id), c.clawbackDays || (c.clawbackMonths ? c.clawbackMonths * 30 : 90)]));
    }

    await Promise.all(leads.map((lead) => {
      let holdAmount = 0;
      if (lead.productType === 'credit_card' && holdPct > 0) {
        holdAmount = Math.round(lead.commission * holdPct / 100);
        const clawbackDays = cardClawbackMap[String(lead.cardProduct)] || 90;
        if (clawbackDays > 0) {
          const until = new Date(now);
          until.setDate(until.getDate() + clawbackDays);
          lead.clawbackUntil = until;
        }
        lead.holdAmount = holdAmount;
      }
      lead.payoutHistory.push({ amount: lead.commission - holdAmount, sentAt: now, sentBy: req.user._id, month });
      lead.commissionStatus = 'paid';
      lead.commissionPaidAt = now;
      return lead.save();
    }));
    try {
      const agentMap = {};
      for (const l of leads) {
        const id = String(l.agent);
        if (!agentMap[id]) agentMap[id] = { count: 0, total: 0 };
        agentMap[id].count += 1;
        agentMap[id].total += l.commission || 0;
      }
      await Promise.all(
        Object.entries(agentMap).map(([agentId, { count, total }]) =>
          createAndEmit(
            [agentId],
            {
              type: 'commission_paid',
              title: 'Commission Paid',
              body: `${count} commission(s) paid — AED ${Number(total).toLocaleString()} total`,
            },
            req.user._id,
          )
        )
      );
    } catch (_) {}
    res.json({ count: leads.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/leads/pay-from-bucket-agent  (admin)
 * Pays selected 'payable' leads to agents, funding the net payout from the
 * leads' agency's bucket balance instead of it being a plain admin payout.
 * All selected leads must belong to the same agency.
 * Body: { leadIds: string[], holdPct?: number }
 */
exports.payFromBucketAgent = async (req, res) => {
  try {
    const { leadIds, holdPct: rawHoldPct } = req.body;
    if (!Array.isArray(leadIds) || !leadIds.length)
      return res.status(400).json({ message: 'Select at least one lead' });
    const holdPct = Math.min(100, Math.max(0, Number(rawHoldPct) || 0));

    const leads = await Lead.find({ _id: { $in: leadIds }, commissionStatus: 'payable' });
    if (leads.length !== leadIds.length)
      return res.status(400).json({ message: 'Some leads not found or already paid' });

    const agencyIds = [...new Set(leads.map((l) => String(l.agency)))];
    if (agencyIds.length !== 1)
      return res.status(400).json({ message: 'Select leads from one agency at a time' });

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let cardClawbackMap = {};
    if (holdPct > 0) {
      const cardIds = [...new Set(leads.filter((l) => l.productType === 'credit_card' && l.cardProduct).map((l) => String(l.cardProduct)))];
      const cards = await CardProduct.find({ _id: { $in: cardIds } }).select('clawbackMonths clawbackDays');
      cardClawbackMap = Object.fromEntries(cards.map((c) => [String(c._id), c.clawbackDays || (c.clawbackMonths ? c.clawbackMonths * 30 : 90)]));
    }

    const holdAmounts = {};
    let netTotal = 0;
    leads.forEach((lead) => {
      let holdAmount = 0;
      if (lead.productType === 'credit_card' && holdPct > 0) {
        holdAmount = Math.round(lead.commission * holdPct / 100);
      }
      holdAmounts[String(lead._id)] = holdAmount;
      netTotal += (lead.commission || 0) - holdAmount;
    });

    const agency = await User.findById(agencyIds[0]);
    if (!agency) return res.status(404).json({ message: 'Agency not found' });

    const bucketAvailable = agency.bucketBalance || 0;

    await Promise.all(leads.map((lead) => {
      const holdAmount = holdAmounts[String(lead._id)];
      if (lead.productType === 'credit_card' && holdAmount > 0) {
        const clawbackDays = cardClawbackMap[String(lead.cardProduct)] || 90;
        if (clawbackDays > 0) {
          const until = new Date(now);
          until.setDate(until.getDate() + clawbackDays);
          lead.clawbackUntil = until;
        }
        lead.holdAmount = holdAmount;
      }
      lead.payoutHistory.push({ amount: lead.commission - holdAmount, sentAt: now, sentBy: req.user._id, month, note: 'Funded from agency bucket' });
      lead.commissionStatus = 'paid';
      lead.commissionPaidAt = now;
      return lead.save();
    }));

    agency.bucketBalance = bucketAvailable - netTotal;
    await agency.save();

    await AgencyPayout.create({
      agency: agencyIds[0],
      leads: leadIds,
      totalSelected: netTotal,
      amountPaid: 0,
      bucketUsed: netTotal,
      bucketAdded: 0,
      receiptNote: 'Agent payout funded from bucket (admin)',
    });

    try {
      const agentMap = {};
      for (const l of leads) {
        const id = String(l.agent);
        if (!agentMap[id]) agentMap[id] = { count: 0, total: 0 };
        agentMap[id].count += 1;
        agentMap[id].total += l.commission || 0;
      }
      await Promise.all(
        Object.entries(agentMap).map(([agentId, { count, total }]) =>
          createAndEmit(
            [agentId],
            {
              type: 'commission_paid',
              title: 'Commission Paid',
              body: `${count} commission(s) paid — AED ${Number(total).toLocaleString()} total`,
            },
            req.user._id,
          )
        )
      );
    } catch (_) {}

    res.json({ count: leads.length, bucketBalance: agency.bucketBalance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/leads/pay-from-bucket-full  (admin)
 * Full settlement in one shot: the agency never actually paid admin for these
 * disbursed leads, but admin funds BOTH the agency's debt and the agent's
 * payout straight from that agency's bucket balance. Deducts the full
 * grossCommission (not just the agent's cut) from the agency's bucket.
 * All selected leads must belong to the same agency.
 * Body: { leadIds: string[], holdPct?: number }
 */
exports.payFromBucketFull = async (req, res) => {
  try {
    const { leadIds, holdPct: rawHoldPct } = req.body;
    if (!Array.isArray(leadIds) || !leadIds.length)
      return res.status(400).json({ message: 'Select at least one lead' });
    const holdPct = Math.min(100, Math.max(0, Number(rawHoldPct) || 0));

    const leads = await Lead.find({
      _id: { $in: leadIds },
      status: 'disbursed',
      agencyPaymentStatus: 'pending',
      commissionStatus: { $in: ['pending', 'none'] },
      commission: { $gt: 0 },
    });
    if (leads.length !== leadIds.length)
      return res.status(400).json({ message: 'Some leads not found or already received/paid' });

    const agencyIds = [...new Set(leads.map((l) => String(l.agency)))];
    if (agencyIds.length !== 1)
      return res.status(400).json({ message: 'Select leads from one agency at a time' });

    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let cardClawbackMap = {};
    if (holdPct > 0) {
      const cardIds = [...new Set(leads.filter((l) => l.productType === 'credit_card' && l.cardProduct).map((l) => String(l.cardProduct)))];
      const cards = await CardProduct.find({ _id: { $in: cardIds } }).select('clawbackMonths clawbackDays');
      cardClawbackMap = Object.fromEntries(cards.map((c) => [String(c._id), c.clawbackDays || (c.clawbackMonths ? c.clawbackMonths * 30 : 90)]));
    }

    const holdAmounts = {};
    let grossTotal = 0;
    leads.forEach((lead) => {
      let holdAmount = 0;
      if (lead.productType === 'credit_card' && holdPct > 0) {
        holdAmount = Math.round(lead.commission * holdPct / 100);
      }
      holdAmounts[String(lead._id)] = holdAmount;
      grossTotal += lead.grossCommission || 0;
    });

    const agency = await User.findById(agencyIds[0]);
    if (!agency) return res.status(404).json({ message: 'Agency not found' });

    const bucketAvailable = agency.bucketBalance || 0;

    await Promise.all(leads.map((lead) => {
      const holdAmount = holdAmounts[String(lead._id)];
      if (lead.productType === 'credit_card' && holdAmount > 0) {
        const clawbackDays = cardClawbackMap[String(lead.cardProduct)] || 90;
        if (clawbackDays > 0) {
          const until = new Date(now);
          until.setDate(until.getDate() + clawbackDays);
          lead.clawbackUntil = until;
        }
        lead.holdAmount = holdAmount;
      }
      lead.agencyPaymentStatus = 'received';
      lead.agencyPaymentReceivedAt = now;
      lead.agencyPaymentNote = 'Paid via bucket (admin) — full settlement';
      lead.payoutHistory.push({ amount: lead.commission - holdAmount, sentAt: now, sentBy: req.user._id, month, note: 'Funded from agency bucket — full settlement' });
      lead.commissionStatus = 'paid';
      lead.commissionPaidAt = now;
      return lead.save();
    }));

    agency.bucketBalance = bucketAvailable - grossTotal;
    await agency.save();

    await AgencyPayout.create({
      agency: agencyIds[0],
      leads: leadIds,
      totalSelected: grossTotal,
      amountPaid: 0,
      bucketUsed: grossTotal,
      bucketAdded: 0,
      receiptNote: 'Full settlement (agency debt + agent payout) funded from bucket (admin)',
    });

    try {
      const agentMap = {};
      for (const l of leads) {
        const id = String(l.agent);
        if (!agentMap[id]) agentMap[id] = { count: 0, total: 0 };
        agentMap[id].count += 1;
        agentMap[id].total += l.commission || 0;
      }
      await Promise.all(
        Object.entries(agentMap).map(([agentId, { count, total }]) =>
          createAndEmit(
            [agentId],
            {
              type: 'commission_paid',
              title: 'Commission Paid',
              body: `${count} commission(s) paid — AED ${Number(total).toLocaleString()} total`,
            },
            req.user._id,
          )
        )
      );
    } catch (_) {}

    res.json({ count: leads.length, bucketBalance: agency.bucketBalance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/leads/bulk-mark-received  (admin)
 * Body: { leadIds?: string[], note?: string }
 * Marks gross commission as received from agency.
 */
exports.bulkMarkReceived = async (req, res) => {
  try {
    const { leadIds, note } = req.body;
    if (!leadIds?.length) return res.status(400).json({ message: 'leadIds are required' });
    const filter = { _id: { $in: leadIds }, agencyPaymentStatus: 'agency_paid' };
    const result = await Lead.updateMany(filter, {
      agencyPaymentStatus: 'received',
      agencyPaymentReceivedAt: new Date(),
      ...(note ? { agencyPaymentNote: note.trim() } : {}),
    });
    // Flip commissionStatus → payable so admin can now pay out to agents.
    // Handle both 'pending' and 'none' (legacy leads disbursed before commission tracking).
    const receivedFilter = { _id: { $in: leadIds }, commissionStatus: { $in: ['pending', 'none'] }, commission: { $gt: 0 } };
    await Lead.updateMany(receivedFilter, { commissionStatus: 'payable' });
    try {
      const paidLeads = await Lead.find({ _id: { $in: leadIds } })
        .select('customerName agency agent commission')
        .lean();
      await Promise.all(
        paidLeads.map((l) =>
          createAndEmit(
            [String(l.agency), String(l.agent)],
            {
              type: 'commission_payable',
              title: 'Commission Ready',
              body: `${l.customerName} — AED ${Number(l.commission || 0).toLocaleString()} now payable`,
              lead: l._id,
            },
            req.user._id,
          )
        )
      );
    } catch (_) {}
    res.json({ count: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/leads/admin-pay-from-bucket  (admin)
 * Admin marks pending leads as received by drawing straight from the agency's bucket balance.
 * Body: { leadIds: [...] } — all leads must belong to the same agency.
 */
exports.adminPayFromBucket = async (req, res) => {
  try {
    const { leadIds } = req.body;
    if (!Array.isArray(leadIds) || !leadIds.length)
      return res.status(400).json({ message: 'Select at least one lead' });

    const leads = await Lead.find({ _id: { $in: leadIds }, agencyPaymentStatus: 'pending' });
    if (leads.length !== leadIds.length)
      return res.status(400).json({ message: 'Some leads not found or already submitted/received' });

    const agencyIds = [...new Set(leads.map((l) => String(l.agency)))];
    if (agencyIds.length !== 1)
      return res.status(400).json({ message: 'Select leads from one agency at a time' });

    const total = leads.reduce((sum, l) => sum + (l.grossCommission || 0), 0);
    const agency = await User.findById(agencyIds[0]);
    if (!agency) return res.status(404).json({ message: 'Agency not found' });

    const bucketAvailable = agency.bucketBalance || 0;

    agency.bucketBalance = bucketAvailable - total;
    await agency.save();

    await Lead.updateMany(
      { _id: { $in: leadIds } },
      {
        agencyPaymentStatus: 'received',
        agencyPaymentReceivedAt: new Date(),
        agencyPaymentNote: 'Paid via bucket (admin)',
      }
    );
    await Lead.updateMany(
      { _id: { $in: leadIds }, commissionStatus: { $in: ['pending', 'none'] }, commission: { $gt: 0 } },
      { commissionStatus: 'payable' }
    );

    await AgencyPayout.create({
      agency: agencyIds[0],
      leads: leadIds,
      totalSelected: total,
      amountPaid: 0,
      bucketUsed: total,
      bucketAdded: 0,
      receiptNote: 'Paid via bucket (admin)',
    });

    try {
      await Promise.all(
        leads.map((l) =>
          createAndEmit(
            [String(l.agency), String(l.agent)],
            {
              type: 'commission_payable',
              title: 'Commission Ready',
              body: `${l.customerName} — AED ${Number(l.commission || 0).toLocaleString()} now payable`,
              lead: l._id,
            },
            req.user._id,
          )
        )
      );
    } catch (_) {}

    res.json({ count: leads.length, bucketBalance: agency.bucketBalance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/leads/bulk-receipt  (agency)
 * Body: { leadIds: string[], receipt?: string } + optional file
 */
exports.bulkAddReceipt = async (req, res) => {
  try {
    const { leadIds, receipt } = req.body;
    const hasFile = !!req.file;
    if (!receipt && !hasFile) return res.status(400).json({ message: 'Provide a reference number or upload a file' });
    if (!leadIds?.length) return res.status(400).json({ message: 'Select at least one lead' });
    const ids = Array.isArray(leadIds) ? leadIds : JSON.parse(leadIds);
    const leads = await Lead.find({ _id: { $in: ids }, agency: req.user._id, status: 'disbursed' });
    if (!leads.length) return res.status(404).json({ message: 'No eligible leads found' });
    const now = new Date();
    await Promise.all(leads.map((lead) => {
      if (receipt) lead.disbursementReceipt = String(receipt).trim();
      if (hasFile) lead.disbursementReceiptFile = getFilename(req.file);
      lead.disbursementReceiptAt = now;
      return lead.save();
    }));
    res.json({ count: leads.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/leads/:id/complete-referral  (agent)
 * Fill in product/bank details for a referral lead submitted by a customer.
 */
exports.completeReferral = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, agent: req.user._id, isReferral: true });
    if (!lead) return res.status(404).json({ message: 'Referral lead not found' });
    if (lead.productType) return res.status(400).json({ message: 'Lead already completed' });

    const { productType, cardProduct, loanProduct, loanAmount, loanType, customerSalary } = req.body;
    if (!productType) return res.status(400).json({ message: 'Product type required' });
    if (productType === 'credit_card' && !cardProduct) return res.status(400).json({ message: 'Card product required' });
    if (productType === 'loan' && !loanProduct) return res.status(400).json({ message: 'Loan product required' });

    let bank, agency, productDoc;
    if (productType === 'credit_card') {
      productDoc = await CardProduct.findById(cardProduct);
      if (!productDoc) return res.status(404).json({ message: 'Card product not found' });
      bank = productDoc.bank;
      agency = productDoc.agency;
    } else {
      productDoc = await LoanProduct.findById(loanProduct);
      if (!productDoc) return res.status(404).json({ message: 'Loan product not found' });
      bank = productDoc.bank;
      agency = productDoc.agency;
    }

    lead.productType = productType;
    lead.bank = bank;
    if (agency) lead.agency = agency;
    if (productType === 'credit_card') {
      lead.cardProduct = cardProduct;
    } else {
      lead.loanProduct = loanProduct;
      if (loanAmount) lead.loanAmount = loanAmount;
      if (loanType) lead.loanType = loanType;
    }
    // Agent's bracket selection determines which commission tier applies — always honour it
    if (customerSalary != null) lead.customerSalary = customerSalary;

    // Compute commission directly from the product doc we already fetched
    const effSalary = lead.customerSalary;
    const brackets = productDoc.commissionBrackets || [];
    if (brackets.length > 0) {
      const sorted = [...brackets].sort((a, b) => a.minimumSalary - b.minimumSalary);
      const eligible = sorted.filter((b) => b.minimumSalary <= effSalary);
      const bracket = eligible.length ? eligible[eligible.length - 1] : sorted[0];
      if (bracket) {
        if (productType === 'credit_card') {
          lead.grossCommission = bracket.receivable;
          lead.commission = bracket.payable;
        } else {
          const amt = lead.loanAmount || 0;
          lead.grossCommission = (amt * bracket.receivable) / 100;
          lead.commission = (amt * bracket.payable) / 100;
        }
        if (lead.commission > 0 && lead.commissionStatus === 'none') lead.commissionStatus = 'pending';
      }
    }

    // Auto-assign consent "Sent" and label "New Lead" on completion
    let defConsent = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', label: /^sent$/i, isActive: true });
    if (!defConsent) defConsent = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', isDefault: true, isActive: true });
    if (!defConsent) defConsent = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', isActive: true }).sort({ order: 1, createdAt: 1 });
    if (defConsent) lead.consentStatus = defConsent._id;

    let defLabel = await EmployeeStatus.findOne({ statusType: 'lead_label', label: /^new lead$/i, isActive: true });
    if (!defLabel) defLabel = await EmployeeStatus.findOne({ statusType: 'lead_label', isDefault: true, isActive: true });
    if (!defLabel) defLabel = await EmployeeStatus.findOne({ statusType: 'lead_label', isActive: true }).sort({ order: 1, createdAt: 1 });
    if (defLabel) lead.employeeStatus = defLabel._id;

    await lead.save();

    const populated = await Lead.findById(lead._id)
      .populate('bank', 'name')
      .populate('cardProduct', 'name commissionBrackets clawbackDays')
      .populate('loanProduct', 'name')
      .populate('agent', 'name email')
      .populate('agency', 'name email')
      .populate('employeeStatus', 'label color')
      .populate('consentStatus', 'label color');

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/leads/:id/engagement-status  (agent)
 */
exports.updateEngagementStatus = async (req, res) => {
  try {
    const { engagementStatus } = req.body;
    if (!engagementStatus || !Lead.ENGAGEMENT_STATUSES.includes(engagementStatus)) {
      return res.status(400).json({ message: 'Invalid engagement status' });
    }
    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, agent: req.user._id },
      { engagementStatus },
      { new: true }
    );
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/leads/:id/reference-no  (agent, own lead only)
 */
exports.updateReferenceNo = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, agent: req.user._id });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.referenceNo = (req.body.referenceNo || '').trim();
    await lead.save();
    res.json({ referenceNo: lead.referenceNo });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/leads/:id/remarks  (admin, agency, sales employee)
 */
exports.updateRemarks = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user.role === 'agency') filter.agency = req.user._id;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      filter.$or = [{ assignedEmployee: empId }, { assignedSalesEmployee: empId }];
    }
    const lead = await Lead.findOne(filter);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.remarks = (req.body.remarks || '').trim();
    await lead.save();
    res.json({ remarks: lead.remarks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/leads/:id/documents  (agent own lead, agency own lead, admin any)
 * Appends uploaded files to the lead's documents array.
 */
exports.addDocuments = async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ message: 'At least one document is required' });
    }

    const filter = { _id: req.params.id };
    if (req.user.role === 'agent')  filter.agent  = req.user._id;
    if (req.user.role === 'agency') filter.agency = req.user._id;
    const lead = await Lead.findOne(filter);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const label = (req.body.label || '').trim() || undefined;
    const entries = files.map((f) => ({
      filename: getFilename(f),
      originalName: f.originalname,
      ...(label && { label }),
    }));
    lead.documents.push(...entries);
    await lead.save();

    res.json({ documents: lead.documents });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/leads/:id  (admin, agency, agent, employee)
 * Admin: any lead. Agency: only their leads. Agent: only their leads.
 * Employee: only leads assigned to them.
 */
exports.getOne = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user.role === 'agent') filter.agent = req.user._id;
    if (req.user.role === 'agency') filter.agency = req.user._id;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      filter.$or = [
        { assignedEmployee: empId },
        { assignedCpvEmployee: empId },
        { assignedSalesEmployee: empId },
      ];
    }
    const lead = await Lead.findOne(filter)
      .populate('bank', 'name code hasSpend')
      .populate('agency', 'name email')
      .populate('agent', 'name email phone')
      .populate({ path: 'cardProduct', select: 'name cardType commissionBrackets cashbackCategories cardImage benefits feesEligibility', populate: { path: 'cashbackCategories.category', select: 'name' } })
      .populate('loanProduct', 'name loanCategory commissionBrackets benefits feesEligibility minSalary maxLoanAmount maxTenure interestRateRange')
      .populate('employeeStatus', 'label color')
      .populate('consentStatus', 'label color')
      .populate('assignedEmployee', 'name email')
      .populate('assignedCpvEmployee', 'name email employeeType')
      .populate('assignedSalesEmployee', 'name email employeeType')
      .populate('payoutHistory.sentBy', 'name email')
      .populate('statusHistory.changedBy', 'name email')
      .populate('leadNotes.author', 'name email employeeId')
      .populate('consentStatusHistory.changedBy', 'name email role')
      .populate('consentStatusHistory.consentStatus', 'label color');
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    const out = lead.toObject();
    if (req.user.role === 'employee') {
      delete out.commission;
      delete out.grossCommission;
      delete out.commissionStatus;
      delete out.commissionPaidAt;
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/leads/:id/assign-employee  (agency)
 * Body: { employeeId }
 * Assigns an employee (who belongs to this agency) to the lead.
 */
exports.assignEmployee = async (req, res) => {
  try {
    const { employeeId, type } = req.body; // type: 'cpv' | 'sales' | undefined (legacy)

    const lead = await Lead.findOne({ _id: req.params.id, agency: req.user._id });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (employeeId) {
      const employee = await User.findOne({ _id: employeeId, role: 'employee', agency: req.user._id });
      if (!employee) return res.status(404).json({ message: 'Employee not found or does not belong to your agency' });
    }

    if (type === 'cpv') {
      lead.assignedCpvEmployee = employeeId || undefined;
    } else if (type === 'sales') {
      lead.assignedSalesEmployee = employeeId || undefined;
    } else {
      lead.assignedEmployee = employeeId || undefined;
    }

    // Auto-advance status to 'assigned' when any employee is assigned
    if (employeeId && ['submitted', 'under_review'].includes(lead.status)) {
      lead.status = 'assigned';
      lead.statusHistory.push({ status: 'assigned', note: 'Employee assigned', changedBy: req.user._id, changedAt: new Date() });
    }

    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      if (employeeId) {
        const adminIds = await getAdminIds();
        const typeLabel = type === 'cpv' ? 'CPV' : type === 'sales' ? 'Sales' : 'employee';
        const empName = type === 'cpv'
          ? (populated.assignedCpvEmployee?.name || 'employee')
          : type === 'sales'
            ? (populated.assignedSalesEmployee?.name || 'employee')
            : (populated.assignedEmployee?.name || 'employee');
        await createAndEmit(
          [...adminIds, String(populated.agency?._id || populated.agency), String(employeeId)],
          {
            type: 'lead_assigned',
            title: 'Lead Assigned',
            body: `${lead.customerName} assigned to ${empName} (${typeLabel})`,
            lead: lead._id,
          },
          req.user._id,
        );
      }
    } catch (_) {}
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/leads/bulk-assign-employee  (agency)
 * Body: { leadIds: [], employeeId }
 * Bulk-assigns an employee to multiple leads belonging to this agency.
 */
exports.bulkAssignEmployee = async (req, res) => {
  try {
    const { leadIds, employeeId, type } = req.body; // type: 'cpv' | 'sales' | undefined
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ message: 'leadIds array is required' });
    }

    if (employeeId) {
      const employee = await User.findOne({ _id: employeeId, role: 'employee', agency: req.user._id });
      if (!employee) return res.status(404).json({ message: 'Employee not found or does not belong to your agency' });
    }

    const leads = await Lead.find({ _id: { $in: leadIds }, agency: req.user._id });
    await Promise.all(leads.map(async (lead) => {
      if (type === 'cpv') {
        lead.assignedCpvEmployee = employeeId || undefined;
      } else if (type === 'sales') {
        lead.assignedSalesEmployee = employeeId || undefined;
      } else {
        lead.assignedEmployee = employeeId || undefined;
      }
      if (employeeId && ['submitted', 'under_review'].includes(lead.status)) {
        lead.status = 'assigned';
        lead.statusHistory.push({ status: 'assigned', note: 'Employee assigned', changedBy: req.user._id, changedAt: new Date() });
      }
      return lead.save();
    }));
    try {
      if (employeeId && leads.length) {
        const adminIds = await getAdminIds();
        const emp = await User.findById(employeeId).select('name').lean();
        const typeLabel = type === 'cpv' ? 'CPV' : type === 'sales' ? 'Sales' : 'employee';
        await createAndEmit(
          [...adminIds, String(employeeId)],
          {
            type: 'lead_assigned',
            title: 'Leads Assigned',
            body: `${leads.length} lead(s) assigned to ${emp?.name || 'employee'} (${typeLabel})`,
          },
          req.user._id,
        );
      }
    } catch (_) {}
    res.json({ updated: leads.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/leads/assigned  (employee)
 * Returns all leads assigned to the current employee.
 */
exports.listAssigned = async (req, res) => {
  try {
    const empId = req.user._id;
    const leads = await Lead.find({
      $or: [
        { assignedEmployee: empId },
        { assignedCpvEmployee: empId },
        { assignedSalesEmployee: empId },
      ],
    })
      .populate('bank', 'name code hasSpend')
      .populate('agency', 'name email')
      .populate('agent', 'name email')
      .populate('assignedCpvEmployee', 'name email employeeType')
      .populate('assignedSalesEmployee', 'name email employeeType')
      .populate('cardProduct', 'name cardType')
      .populate('loanProduct', 'name loanCategory')
      .populate('employeeStatus', 'label color')
      .populate('consentStatus', 'label color')
      .populate('consentStatusHistory.consentStatus', 'label color')
      .populate('consentStatusHistory.changedBy', 'name email')
      .sort({ updatedAt: -1 });
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/leads/ledger  (agent)
 */
exports.myLedger = async (req, res) => {
  try {
    const ledger = await commissionService.getAgentLedger(req.user._id);
    const now = new Date();
    const bonus = await commissionService.getMonthlyBonus(req.user._id, now.getFullYear(), now.getMonth());
    res.json({ ...ledger, monthlyBonus: bonus });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/leads/:id/notes  (all roles)
 */
exports.addNote = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: 'text is required' });
    }

    const filter = { _id: req.params.id };
    if (req.user.role === 'agent')  filter.agent  = req.user._id;
    if (req.user.role === 'agency') filter.agency = req.user._id;
    if (req.user.role === 'employee') {
      const empId = req.user._id;
      filter.$or = [{ assignedEmployee: empId }, { assignedCpvEmployee: empId }, { assignedSalesEmployee: empId }];
    }

    const lead = await Lead.findOne(filter);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    lead.leadNotes.push({
      text: String(text).trim(),
      author: req.user._id,
      authorRole: req.user.role,
    });
    await lead.save();

    const populated = await lead.populate([
      ...POPULATE_FIELDS,
      { path: 'leadNotes.author', select: 'name email employeeId' },
      { path: 'statusHistory.changedBy', select: 'name email' },
    ]);
    try {
      const adminIds = await getAdminIds();
      const recipients = [...adminIds, String(populated.agency?._id || populated.agency), String(populated.agent?._id || populated.agent)];
      if (populated.assignedCpvEmployee) recipients.push(String(populated.assignedCpvEmployee?._id || populated.assignedCpvEmployee));
      if (populated.assignedSalesEmployee) recipients.push(String(populated.assignedSalesEmployee?._id || populated.assignedSalesEmployee));
      const truncated = String(text).trim().slice(0, 60) + (String(text).trim().length > 60 ? '…' : '');
      await createAndEmit(
        recipients,
        {
          type: 'note_added',
          title: 'Note Added',
          body: `${lead.customerName} — "${truncated}"`,
          lead: lead._id,
        },
        req.user._id,
      );
    } catch (_) {}
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /api/leads/:id/notes/:noteId  (admin only)
 */
exports.adminDeleteLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    await lead.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteNote = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const note = lead.leadNotes.id(req.params.noteId);
    if (!note) return res.status(404).json({ message: 'Note not found' });

    await note.deleteOne();
    await lead.save();

    const populated = await lead.populate([
      ...POPULATE_FIELDS,
      { path: 'leadNotes.author', select: 'name email employeeId' },
      { path: 'statusHistory.changedBy', select: 'name email' },
    ]);
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const IMPORT_REQUIRED = ['Customer Name', 'Phone'];

const normalizeProductType = (v) => {
  const s = String(v || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (s === 'credit_card' || s === 'card') return 'credit_card';
  if (s === 'loan') return 'loan';
  return null;
};

/**
 * POST /api/leads/import  (admin, agency)
 * Bulk-create leads from an uploaded .xlsx/.xls file.
 * Each row: Customer Name, Phone, Agent Email, Product Type (credit_card/loan),
 * Bank, Product Name, Monthly Salary, + optional Email, Nationality, City,
 * Visa Type, Company Name, Job Title, Experience (Yrs), Loan Amount, Loan Type.
 * Rows that fail validation are skipped and reported; valid rows are created.
 */
exports.importLeads = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'File is required' });

    let rows;
    try {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } catch {
      return res.status(400).json({ message: 'Could not read file — is it a valid Excel file?' });
    }

    if (!rows.length) return res.status(400).json({ message: 'File has no data rows' });

    const failed = [];
    let created = 0;
    let updated = 0;

    const VALID_LEAD_STATUSES = ['draft', 'submitted', 'under_review', 'assigned', 'approved', 'rejected', 'disbursed'];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +1 for header row, +1 for 1-based
      const fail = (reason) => failed.push({ row: rowNum, reason });

      const leadNoRaw = String(row['Lead No'] ?? '').trim();

      // Required fields only enforced when creating (no Lead No provided)
      if (!leadNoRaw) {
        const missing = IMPORT_REQUIRED.filter((k) => !String(row[k] ?? '').trim());
        if (missing.length) { fail(`Missing required field(s): ${missing.join(', ')}`); continue; }
      }

      // Everything below is best-effort: a blank cell is simply skipped, but a
      // value that IS provided must resolve to something real or the row fails.

      let agentId = req.user._id; // default: importer themself owns the lead
      const agentEmailRaw = String(row['Agent Email'] ?? '').trim();
      if (agentEmailRaw) {
        const agent = await User.findOne({ email: agentEmailRaw.toLowerCase(), role: 'agent' });
        if (!agent) { fail(`No agent found with email "${agentEmailRaw}"`); continue; }
        agentId = agent._id;
      }

      let customerSalary;
      const salaryRaw = row['Monthly Salary'];
      if (salaryRaw !== '' && salaryRaw != null) {
        customerSalary = Number(salaryRaw);
        if (!Number.isFinite(customerSalary) || customerSalary < 5000) { fail('Monthly Salary must be a number ≥ 5,000'); continue; }
      }

      let productType, bank, cardProduct, loanProduct, loanAmount, loanType;
      const productTypeRaw = String(row['Product Type'] ?? '').trim();
      if (productTypeRaw) {
        productType = normalizeProductType(productTypeRaw);
        if (!productType) { fail(`Product Type must be "credit_card" or "loan", got "${productTypeRaw}"`); continue; }

        const bankNameRaw = String(row['Bank'] ?? '').trim();
        const productNameRaw = String(row['Product Name'] ?? '').trim();
        if (bankNameRaw && productNameRaw) {
          bank = await Bank.findOne({ name: new RegExp(`^${bankNameRaw}$`, 'i') });
          if (!bank) { fail(`No bank found named "${bankNameRaw}"`); continue; }

          if (productType === 'credit_card') {
            cardProduct = await CardProduct.findOne({ name: new RegExp(`^${productNameRaw}$`, 'i'), bank: bank._id });
            if (!cardProduct) { fail(`No credit card product named "${productNameRaw}" at ${bankNameRaw}`); continue; }
          } else {
            loanProduct = await LoanProduct.findOne({ name: new RegExp(`^${productNameRaw}$`, 'i'), bank: bank._id });
            if (!loanProduct) { fail(`No loan product named "${productNameRaw}" at ${bankNameRaw}`); continue; }
            const loanAmountRaw = row['Loan Amount'];
            if (loanAmountRaw !== '' && loanAmountRaw != null) {
              loanAmount = Number(loanAmountRaw);
              if (!Number.isFinite(loanAmount) || loanAmount <= 0) { fail('Loan Amount must be a number > 0'); continue; }
            }
            if (row['Loan Type']) loanType = String(row['Loan Type']).trim();
          }
        }
      }

      // Agency scoping: the product itself (not the agent) determines ownership —
      // agents in this app aren't tied to a fixed agency, so an agency importer may
      // only bulk-create leads against products their own agency owns. With no
      // product resolved, an agency importer's leads simply belong to themself.
      const productAgency = cardProduct?.agency || loanProduct?.agency;
      if (req.user.role === 'agency' && productAgency && String(productAgency) !== String(req.user._id)) {
        fail(`Product "${row['Product Name']}" does not belong to your agency`); continue;
      }

      const agencyId = req.user.role === 'agency' ? req.user._id : productAgency;

      const phoneRaw = String(row['Phone'] ?? '').trim();
      if (!isValidUAEPhone(phoneRaw)) { fail(`Invalid UAE mobile number "${phoneRaw}" — must start with 9715 (e.g. 971501234567)`); continue; }

      const leadData = {
        customerName: String(row['Customer Name']).trim(),
        phone: phoneRaw,
        agent: agentId,
        status: 'submitted',
      };
      if (agencyId) leadData.agency = agencyId;
      if (productType) leadData.productType = productType;
      if (bank) leadData.bank = bank._id;
      if (customerSalary != null) leadData.customerSalary = customerSalary;
      if (row['Email']) leadData.email = String(row['Email']).trim();
      if (row['Nationality']) leadData.nationality = String(row['Nationality']).trim();
      if (row['City']) leadData.city = String(row['City']).trim();
      if (row['Visa Type']) leadData.visaType = String(row['Visa Type']).trim();
      if (row['Company Name']) leadData.companyName = String(row['Company Name']).trim();
      if (row['Job Title']) leadData.jobTitle = String(row['Job Title']).trim();
      if (row['Experience (Yrs)'] !== '') leadData.yearsOfExperience = Number(row['Experience (Yrs)']) || undefined;
      if (row['Remarks']) leadData.remarks = String(row['Remarks']).trim();
      if (cardProduct) leadData.cardProduct = cardProduct._id;
      if (loanProduct) { leadData.loanProduct = loanProduct._id; if (loanAmount != null) leadData.loanAmount = loanAmount; if (loanType) leadData.loanType = loanType; }

      if (leadNoRaw) {
        // UPDATE existing lead by leadNumber
        try {
          const existing = await Lead.findOne({ leadNumber: leadNoRaw });
          if (!existing) { fail(`No lead found with Lead No "${leadNoRaw}"`); continue; }

          const updateFields = {};
          if (leadData.customerName) updateFields.customerName = leadData.customerName;
          if (leadData.phone) updateFields.phone = leadData.phone;
          if (row['Agent Email'] && leadData.agent) updateFields.agent = leadData.agent;
          if (leadData.agency) updateFields.agency = leadData.agency;
          if (leadData.productType) updateFields.productType = leadData.productType;
          if (leadData.bank) updateFields.bank = leadData.bank;
          if (leadData.customerSalary != null) updateFields.customerSalary = leadData.customerSalary;
          if (leadData.email) updateFields.email = leadData.email;
          if (leadData.nationality) updateFields.nationality = leadData.nationality;
          if (leadData.city) updateFields.city = leadData.city;
          if (leadData.visaType) updateFields.visaType = leadData.visaType;
          if (leadData.companyName) updateFields.companyName = leadData.companyName;
          if (leadData.jobTitle) updateFields.jobTitle = leadData.jobTitle;
          if (leadData.yearsOfExperience) updateFields.yearsOfExperience = leadData.yearsOfExperience;
          if (leadData.cardProduct) updateFields.cardProduct = leadData.cardProduct;
          if (leadData.loanProduct) {
            updateFields.loanProduct = leadData.loanProduct;
            if (leadData.loanAmount) updateFields.loanAmount = leadData.loanAmount;
            if (leadData.loanType) updateFields.loanType = leadData.loanType;
          }
          if (row['Reference No']) updateFields.referenceNo = String(row['Reference No']).trim();
          if (row['Remarks']) updateFields.remarks = String(row['Remarks']).trim();
          // Accept both 'Lead Status' and 'Status' (export uses 'Status')
          const statusRaw = String(row['Lead Status'] ?? row['Status'] ?? '').trim();
          if (statusRaw) {
            const normalized = statusRaw.toLowerCase().replace(/\s+/g, '_');
            if (VALID_LEAD_STATUSES.includes(normalized)) {
              updateFields.status = normalized;
            } else {
              // Try as employee status label fallback
              const empStatusFallback = await EmployeeStatus.findOne({ label: new RegExp(`^${statusRaw}$`, 'i'), statusType: 'lead_label', isActive: true });
              if (!empStatusFallback) { fail(`Invalid status "${statusRaw}". Valid pipeline: ${VALID_LEAD_STATUSES.join(', ')}. Or use a label from Employee Statuses.`); continue; }
              updateFields.employeeStatus = empStatusFallback._id;
            }
          }
          const cpvRaw = String(row['CPV Done'] ?? '').trim().toLowerCase();
          if (cpvRaw) {
            if (!['yes', 'no', 'true', 'false', '1', '0'].includes(cpvRaw)) { fail(`CPV Done must be Yes or No, got "${row['CPV Done']}"`); continue; }
            updateFields.cpvDone = ['yes', 'true', '1'].includes(cpvRaw);
          }
          const activateRaw = String(row['Activated'] ?? '').trim().toLowerCase();
          if (activateRaw) {
            if (!['yes', 'no', 'true', 'false', '1', '0'].includes(activateRaw)) { fail(`Activated must be Yes or No, got "${row['Activated']}"`); continue; }
            updateFields.activateDone = ['yes', 'true', '1'].includes(activateRaw);
          }
          const spendRaw = String(row['Spent Activation'] ?? '').trim().toLowerCase();
          if (spendRaw) {
            if (!['yes', 'no', 'true', 'false', '1', '0'].includes(spendRaw)) { fail(`Spent Activation must be Yes or No, got "${row['Spent Activation']}"`); continue; }
            updateFields.spendDone = ['yes', 'true', '1'].includes(spendRaw);
          }
          const rejectedRaw = String(row['Rejected'] ?? '').trim().toLowerCase();
          if (rejectedRaw) {
            if (!['yes', 'no', 'true', 'false', '1', '0'].includes(rejectedRaw)) { fail(`Rejected must be Yes or No, got "${row['Rejected']}"`); continue; }
            if (['yes', 'true', '1'].includes(rejectedRaw)) updateFields.status = 'rejected';
          }
          const disbursedRaw = String(row['Disbursed'] ?? '').trim().toLowerCase();
          if (disbursedRaw) {
            if (!['yes', 'no', 'true', 'false', '1', '0'].includes(disbursedRaw)) { fail(`Disbursed must be Yes or No, got "${row['Disbursed']}"`); continue; }
            if (['yes', 'true', '1'].includes(disbursedRaw)) updateFields.status = 'disbursed';
          }
          if (productType && (cardProduct || loanProduct)) {
            const { receivable, payable } = await commissionService.resolveCommissions({
              productType, cardProduct: leadData.cardProduct, loanProduct: leadData.loanProduct, loanAmount, customerSalary,
            });
            updateFields.grossCommission = receivable;
            updateFields.commission = payable;
          }

          await Lead.findByIdAndUpdate(existing._id, { $set: updateFields });
          updated += 1;
        } catch (err) {
          fail(`Could not update lead: ${err.message}`);
        }
      } else {
        // CREATE new lead
        try {
          const { receivable, payable } = productType
            ? await commissionService.resolveCommissions({
                productType, cardProduct: leadData.cardProduct, loanProduct: leadData.loanProduct, loanAmount, customerSalary,
              })
            : { receivable: 0, payable: 0 };
          leadData.grossCommission = receivable;
          leadData.commission = payable;

          const cpvRawCreate = String(row['CPV Done'] ?? '').trim().toLowerCase();
          if (cpvRawCreate) {
            if (!['yes', 'no', 'true', 'false', '1', '0'].includes(cpvRawCreate)) { fail(`CPV Done must be Yes or No, got "${row['CPV Done']}"`); continue; }
            leadData.cpvDone = ['yes', 'true', '1'].includes(cpvRawCreate);
          }
          const activateRawCreate = String(row['Activated'] ?? '').trim().toLowerCase();
          if (activateRawCreate) {
            if (!['yes', 'no', 'true', 'false', '1', '0'].includes(activateRawCreate)) { fail(`Activated must be Yes or No, got "${row['Activated']}"`); continue; }
            leadData.activateDone = ['yes', 'true', '1'].includes(activateRawCreate);
          }
          const spendRawCreate = String(row['Spent Activation'] ?? '').trim().toLowerCase();
          if (spendRawCreate) {
            if (!['yes', 'no', 'true', 'false', '1', '0'].includes(spendRawCreate)) { fail(`Spent Activation must be Yes or No, got "${row['Spent Activation']}"`); continue; }
            leadData.spendDone = ['yes', 'true', '1'].includes(spendRawCreate);
          }
          const rejectedRawCreate = String(row['Rejected'] ?? '').trim().toLowerCase();
          if (rejectedRawCreate) {
            if (!['yes', 'no', 'true', 'false', '1', '0'].includes(rejectedRawCreate)) { fail(`Rejected must be Yes or No, got "${row['Rejected']}"`); continue; }
            if (['yes', 'true', '1'].includes(rejectedRawCreate)) leadData.status = 'rejected';
          }
          const disbursedRawCreate = String(row['Disbursed'] ?? '').trim().toLowerCase();
          if (disbursedRawCreate) {
            if (!['yes', 'no', 'true', 'false', '1', '0'].includes(disbursedRawCreate)) { fail(`Disbursed must be Yes or No, got "${row['Disbursed']}"`); continue; }
            if (['yes', 'true', '1'].includes(disbursedRawCreate)) leadData.status = 'disbursed';
          }

          const agentDoc = await User.findByIdAndUpdate(agentId, { $inc: { leadCount: 1 } }, { new: true, select: 'leadCount' });
          const agentShortId = String(agentId).slice(-6).toUpperCase();
          const seq = String(agentDoc.leadCount).padStart(4, '0');
          leadData.leadNumber = `LD-${agentShortId}-${seq}`;

          await Lead.create(leadData);
          created += 1;
        } catch (err) {
          fail(`Could not create lead: ${err.message}`);
        }
      }
    }

    if (created > 0 || updated > 0) {
      try {
        const adminIds = await getAdminIds();
        const parts = [];
        if (created > 0) parts.push(`created ${created}`);
        if (updated > 0) parts.push(`updated ${updated}`);
        await createAndEmit(
          adminIds,
          {
            type: 'lead_created',
            title: 'Leads Imported',
            body: `${req.user.name || req.user.email} ${parts.join(', ')} lead(s) from Excel`,
          },
          req.user._id,
        );
      } catch (_) {}
    }

    res.json({ created, updated, failed, total: rows.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
