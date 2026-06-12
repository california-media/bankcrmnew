const Lead = require('../models/Lead');
const Bank = require('../models/Bank');
const User = require('../models/User');
const CardProduct = require('../models/CardProduct');
const LoanProduct = require('../models/LoanProduct');
const EmployeeStatus = require('../models/EmployeeStatus');
const commissionService = require('../services/commission.service');
const { createAndEmit, getAdminIds, formatStatus } = require('../utils/notify');
const waba = require('../services/waba.service');

const POPULATE_FIELDS = [
  { path: 'bank', select: 'name code' },
  { path: 'agency', select: 'name email' },
  { path: 'agent', select: 'name email' },
  { path: 'cardProduct', select: 'name cardType commissionBrackets cardImage benefits feesEligibility' },
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
    const { customerName, phone, productType, cardProduct, loanProduct, loanAmount, loanType, customerSalary, notes, email, visaType, nationality, companyName, jobTitle, yearsOfExperience } = req.body;
    if (!customerName || !phone || !productType) {
      return res.status(400).json({ message: 'customerName, phone, and productType are required' });
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
    if (email) leadData.email = email.trim();
    if (visaType) leadData.visaType = visaType.trim();
    if (nationality) leadData.nationality = nationality.trim();
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
    const pendingConsent = await EmployeeStatus.findOne({ label: /^pending$/i, statusType: 'whatsapp_consent', isActive: true });
    if (pendingConsent) leadData.consentStatus = pendingConsent._id;

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
      .populate('bank', 'name code')
      .populate('agency', 'name email')
      .populate('cardProduct', 'name cardType commissionBrackets')
      .populate('loanProduct', 'name loanCategory commissionBrackets')
      .populate('employeeStatus', 'label color')
      .populate('consentStatus', 'label color')
      .populate('consentStatusHistory.consentStatus', 'label color')
      .populate('consentStatusHistory.changedBy', 'name email')
      .sort({ createdAt: -1 });
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
      .populate('bank', 'name code')
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
      .sort({ createdAt: -1 });
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
      .populate('bank', 'name code')
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
      .sort({ createdAt: -1 });
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
    if (hasFile) lead.disbursementReceiptFile = req.file.filename;
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
      if (hasFile) lead.disbursementReceiptFile = req.file.filename;
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

    let bank, agency;
    if (productType === 'credit_card') {
      const CardProduct = require('../models/CardProduct');
      const card = await CardProduct.findById(cardProduct).select('bank agency');
      if (!card) return res.status(404).json({ message: 'Card product not found' });
      bank = card.bank;
      agency = card.agency;
    } else {
      const LoanProduct = require('../models/LoanProduct');
      const loan = await LoanProduct.findById(loanProduct).select('bank agency');
      if (!loan) return res.status(404).json({ message: 'Loan product not found' });
      bank = loan.bank;
      agency = loan.agency;
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
    if (customerSalary) lead.customerSalary = customerSalary;

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
      .populate('bank', 'name code')
      .populate('agency', 'name email')
      .populate('agent', 'name email phone')
      .populate('cardProduct', 'name cardType commissionBrackets cardImage benefits feesEligibility')
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
      .populate('bank', 'name code')
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
      .sort({ createdAt: -1 });
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
