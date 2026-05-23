const Lead = require('../models/Lead');
const Bank = require('../models/Bank');
const User = require('../models/User');
const CardProduct = require('../models/CardProduct');
const LoanProduct = require('../models/LoanProduct');
const EmployeeStatus = require('../models/EmployeeStatus');
const commissionService = require('../services/commission.service');
const { createAndEmit, getAdminIds, formatStatus } = require('../utils/notify');

const POPULATE_FIELDS = [
  { path: 'bank', select: 'name code' },
  { path: 'agency', select: 'name email' },
  { path: 'agent', select: 'name email' },
  { path: 'cardProduct', select: 'name cardType commissionBrackets cardImage benefits feesEligibility' },
  { path: 'loanProduct', select: 'name loanCategory commissionBrackets benefits feesEligibility minSalary maxLoanAmount maxTenure interestRateRange' },
  { path: 'employeeStatus', select: 'label color' },
  { path: 'consentStatus', select: 'label color' },
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
    const { customerName, phone, productType, cardProduct, loanProduct, loanAmount, customerSalary, notes, email, visaType, nationality, companyName, jobTitle, yearsOfExperience } = req.body;
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
    if (productType === 'loan') { leadData.loanProduct = loanProduct; leadData.loanAmount = loanAmount; }

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

    // Auto-assign default consent status: explicit default first, fallback to lowest order
    let defaultConsent = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', isDefault: true, isActive: true });
    if (!defaultConsent) {
      defaultConsent = await EmployeeStatus.findOne({ statusType: 'whatsapp_consent', isActive: true }).sort({ order: 1, createdAt: 1 });
    }
    if (defaultConsent && !lead.consentStatus) {
      lead.consentStatus = defaultConsent._id;
    }

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
    const [total, approved, rejected, disbursed, cpvDoneCount, activateDoneCount, leads] = await Promise.all([
      Lead.countDocuments({ agent: agentId }),
      Lead.countDocuments({ agent: agentId, status: 'approved' }),
      Lead.countDocuments({ agent: agentId, status: 'rejected' }),
      Lead.countDocuments({ agent: agentId, status: 'disbursed' }),
      Lead.countDocuments({ agent: agentId, cpvDone: true }),
      Lead.countDocuments({ agent: agentId, activateDone: true }),
      Lead.find({ agent: agentId }).select('status commission commissionStatus'),
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

    res.json({
      total, active, drafts, submitted, underReview, assigned,
      approved, rejected, pending, disbursed,
      cpvDone: cpvDoneCount, activateDone: activateDoneCount,
      paidEarnings, pendingEarnings,
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
    lead.payoutHistory.push({
      amount: lead.commission,
      sentAt: now,
      sentBy: req.user._id,
      month,
    });
    lead.commissionStatus = 'paid';
    lead.commissionPaidAt = now;
    await lead.save();
    const populated = await lead.populate(POPULATE_FIELDS);
    try {
      await createAndEmit(
        [String(populated.agent?._id || populated.agent)],
        {
          type: 'commission_paid',
          title: 'Commission Paid',
          body: `${lead.customerName} — AED ${Number(lead.commission || 0).toLocaleString()} commission paid`,
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
    const { leadIds } = req.body;
    const filter = leadIds?.length
      ? { _id: { $in: leadIds }, commissionStatus: 'payable' }
      : { commissionStatus: 'payable' };
    const leads = await Lead.find(filter);
    if (!leads.length) return res.status(400).json({ message: 'No payable leads found' });
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    await Promise.all(leads.map((lead) => {
      lead.payoutHistory.push({ amount: lead.commission, sentAt: now, sentBy: req.user._id, month });
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
    if (req.user.role === 'agency') delete out.agent;
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
