const User = require('../models/User');
const Lead = require('../models/Lead');
const { generateReferralCode } = require('../utils/token');

const sanitizeAgent = (user) => ({
  id: user._id,
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  referralCode: user.referralCode,
  isActive: user.isActive,
  createdAt: user.createdAt,
  bankDetails: user.bankDetails,
});

/**
 * GET /api/admin/agents  (admin)
 * Response: agents with summary counts (total leads, approved leads, paid commission).
 */
exports.listAgents = async (req, res) => {
  try {
    const agents = await User.find({ role: 'agent' })
      .select('-password -inviteToken -inviteTokenExpires')
      .populate('referredBy', 'name email referralCode')
      .sort({ createdAt: -1 });

    const ids = agents.map((a) => a._id);
    const stats = await Lead.aggregate([
      { $match: { agent: { $in: ids } } },
      {
        $group: {
          _id: '$agent',
          total: { $sum: 1 },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          paidCommission: {
            $sum: { $cond: [{ $eq: ['$commissionStatus', 'paid'] }, '$commission', 0] },
          },
        },
      },
    ]);
    const byAgent = Object.fromEntries(stats.map((s) => [String(s._id), s]));

    const enriched = agents.map((a) => ({
      ...a.toObject(),
      stats: byAgent[String(a._id)] || { total: 0, approved: 0, paidCommission: 0 },
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/admin/overview  (admin)
 * Top-level counts for the admin landing page.
 */
exports.overview = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [agents, agencies, banks, totalLeads, approvedLeads, pendingLeads, activeLeads, cpvDoneLeads, activateDoneLeads, paidAgg, payableAgg, pipelineAgg, topAgentsAgg, productPayoutsAgg] = await Promise.all([
      User.countDocuments({ role: 'agent' }),
      User.countDocuments({ role: 'agency' }),
      require('../models/Bank').countDocuments(),
      Lead.countDocuments(),
      Lead.countDocuments({ status: 'approved' }),
      Lead.countDocuments({ status: { $in: ['submitted', 'under_review'] } }),
      Lead.countDocuments({ status: { $in: ['submitted', 'under_review', 'assigned', 'approved'] } }),
      Lead.countDocuments({ cpvDone: true }),
      Lead.countDocuments({ activateDone: true }),
      Lead.aggregate([{ $match: { commissionStatus: 'paid' } }, { $group: { _id: null, sum: { $sum: '$commission' } } }]),
      Lead.aggregate([{ $match: { commissionStatus: 'payable' } }, { $group: { _id: null, sum: { $sum: '$commission' } } }]),
      Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Lead.aggregate([
        { $match: { commissionStatus: 'paid' } },
        { $group: { _id: '$agent', paid: { $sum: '$commission' } } },
        { $sort: { paid: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'agentDoc' } },
        { $unwind: '$agentDoc' },
        { $project: { _id: 1, name: '$agentDoc.name', email: '$agentDoc.email', paid: 1 } },
      ]),
      Lead.aggregate([
        { $match: { commissionStatus: 'paid' } },
        { $group: { _id: '$productType', paid: { $sum: '$commission' }, count: { $sum: 1 } } },
      ]),
    ]);

    const pipelineMap = Object.fromEntries(pipelineAgg.map((p) => [p._id, p.count]));
    const pipeline = [
      { status: 'draft', label: 'Draft', count: pipelineMap.draft || 0 },
      { status: 'submitted', label: 'Submitted', count: pipelineMap.submitted || 0 },
      { status: 'under_review', label: 'Under Review', count: pipelineMap.under_review || 0 },
      { status: 'assigned', label: 'Assigned', count: pipelineMap.assigned || 0 },
      { status: 'approved', label: 'Approved', count: pipelineMap.approved || 0 },
      { status: 'disbursed', label: 'Disbursed', count: pipelineMap.disbursed || 0 },
      { status: 'rejected', label: 'Rejected', count: pipelineMap.rejected || 0 },
    ];

    const [thisMonthLeads, lastMonthLeads, thisMonthPaid, lastMonthPaid, thisMonthActive, lastMonthActive] = await Promise.all([
      Lead.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Lead.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } }),
      Lead.aggregate([{ $match: { commissionStatus: 'paid', createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, sum: { $sum: '$commission' } } }]),
      Lead.aggregate([{ $match: { commissionStatus: 'paid', createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } } }, { $group: { _id: null, sum: { $sum: '$commission' } } }]),
      Lead.countDocuments({ status: { $in: ['submitted', 'under_review', 'assigned', 'approved'] }, createdAt: { $gte: startOfMonth } }),
      Lead.countDocuments({ status: { $in: ['submitted', 'under_review', 'assigned', 'approved'] }, createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } }),
    ]);
    const delta = (curr, prev) => prev === 0 ? null : +((curr - prev) / prev * 100).toFixed(1);

    const PRODUCT_LABELS = { credit_card: 'Credit Card', loan: 'Loan' };
    const productPayouts = productPayoutsAgg.map((p) => ({
      type: p._id,
      label: PRODUCT_LABELS[p._id] || p._id,
      paid: p.paid,
      count: p.count,
    }));

    res.json({
      agents,
      agencies,
      banks,
      totalLeads,
      approvedLeads,
      pendingLeads,
      activeLeads,
      cpvDoneLeads,
      activateDoneLeads,
      paidCommission: paidAgg[0]?.sum || 0,
      payableCommission: payableAgg[0]?.sum || 0,
      pipeline,
      topAgents: topAgentsAgg,
      productPayouts,
      trend: {
        totalLeads: delta(thisMonthLeads, lastMonthLeads),
        activeLeads: delta(thisMonthActive, lastMonthActive),
        paidCommission: delta(thisMonthPaid[0]?.sum || 0, lastMonthPaid[0]?.sum || 0),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/admin/agents/:id  (admin)
 */
exports.getAgent = async (req, res) => {
  try {
    const agent = await User.findOne({ _id: req.params.id, role: 'agent' })
      .select('-password -inviteToken -inviteTokenExpires')
      .populate('referredBy', 'name email referralCode');
    if (!agent) return res.status(404).json({ message: 'Agent not found' });

    const leads = await Lead.find({ agent: agent._id })
      .select('status commission commissionStatus createdAt customerName bank productType loanAmount leadNumber')
      .populate('bank', 'name')
      .sort({ createdAt: -1 });

    const paidLeads = leads.filter((l) => l.commissionStatus === 'paid');
    const stats = {
      total: leads.length,
      approved: leads.filter((l) => ['approved', 'disbursed'].includes(l.status)).length,
      paid: paidLeads.length,
      paidCommission: paidLeads.reduce((s, l) => s + (l.commission || 0), 0),
      pending: leads.filter((l) => ['submitted', 'under_review', 'assigned'].includes(l.status)).length,
    };

    res.json({ agent, stats, leads: leads.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/admin/agents  (admin)
 * Body: { name, email, password, phone? }
 * Response 201: { user }
 */
exports.createAgent = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'name, email, and password are required' });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    const agent = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      phone: phone || undefined,
      role: 'agent',
      isActive: true,
      referralCode: generateReferralCode(),
    });

    res.status(201).json({ user: sanitizeAgent(agent) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/admin/agents/:id  (admin)
 * Body: { name?, email?, phone? }
 */
exports.updateAgent = async (req, res) => {
  try {
    const agent = await User.findOne({ _id: req.params.id, role: 'agent' });
    if (!agent) return res.status(404).json({ message: 'Agent not found' });

    const { name, email, phone, holdPct, bankDetails } = req.body;
    if (name !== undefined) agent.name = name;
    if (phone !== undefined) agent.phone = phone;
    if (holdPct !== undefined) agent.holdPct = Math.min(100, Math.max(0, Number(holdPct) || 0));
    if (email) {
      const lower = email.toLowerCase();
      const conflict = await User.findOne({ email: lower, _id: { $ne: agent._id } });
      if (conflict) return res.status(409).json({ message: 'Email already in use' });
      agent.email = lower;
    }
    if (bankDetails !== undefined) {
      agent.bankDetails = {
        accountHolderName: bankDetails.accountHolderName ?? agent.bankDetails?.accountHolderName ?? '',
        bankName:          bankDetails.bankName          ?? agent.bankDetails?.bankName          ?? '',
        accountNumber:     bankDetails.accountNumber     ?? agent.bankDetails?.accountNumber     ?? '',
        iban:              bankDetails.iban              ?? agent.bankDetails?.iban              ?? '',
        swiftCode:         bankDetails.swiftCode         ?? agent.bankDetails?.swiftCode         ?? '',
      };
    }
    await agent.save();
    res.json({ user: sanitizeAgent(agent) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/admin/agents/:id/reset-password  (admin)
 * Body: { password }
 */
exports.resetAgentPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || String(password).trim().length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const agent = await User.findOne({ _id: req.params.id, role: 'agent' });
    if (!agent) return res.status(404).json({ message: 'Agent not found' });

    agent.password = password;
    await agent.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/admin/agents/:id/toggle-active  (admin)
 */
exports.toggleAgentActive = async (req, res) => {
  try {
    const agent = await User.findOne({ _id: req.params.id, role: 'agent' });
    if (!agent) return res.status(404).json({ message: 'Agent not found' });
    agent.isActive = !agent.isActive;
    await agent.save();
    res.json({ user: sanitizeAgent(agent) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /api/admin/agents/:id  (admin)
 */
exports.deleteAgent = async (req, res) => {
  try {
    const agent = await User.findOneAndDelete({ _id: req.params.id, role: 'agent' });
    if (!agent) return res.status(404).json({ message: 'Agent not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/admin/agencies/pending  (admin)
 */
exports.listPendingAgencies = async (req, res) => {
  try {
    const agencies = await User.find({ role: 'agency', registrationStatus: 'pending' })
      .select('-password -inviteToken -inviteTokenExpires')
      .sort({ createdAt: -1 });
    res.json(agencies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/admin/agencies/:id/approve  (admin)
 */
exports.approveAgency = async (req, res) => {
  try {
    const agency = await User.findOne({ _id: req.params.id, role: 'agency', registrationStatus: 'pending' });
    if (!agency) return res.status(404).json({ message: 'Pending agency not found' });
    agency.isActive = true;
    agency.registrationStatus = 'approved';
    await agency.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/admin/agencies/:id/reject  (admin)
 */
exports.rejectAgency = async (req, res) => {
  try {
    const agency = await User.findOne({ _id: req.params.id, role: 'agency', registrationStatus: 'pending' });
    if (!agency) return res.status(404).json({ message: 'Pending agency not found' });
    agency.registrationStatus = 'rejected';
    await agency.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/admin/blog-editors  (admin)
 */
exports.createBlogEditor = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'name, email, and password are required' });
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Email already registered' });
    const editor = await User.create({
      name, email: email.toLowerCase(), password,
      role: 'blog_editor', isActive: true,
    });
    res.status(201).json({ _id: editor._id, name: editor.name, email: editor.email, role: editor.role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/admin/blog-editors  (admin)
 */
exports.listBlogEditors = async (req, res) => {
  try {
    const editors = await User.find({ role: 'blog_editor' }).select('name email createdAt isActive').lean();
    res.json(editors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PUT /api/admin/blog-editors/:id  (admin)
 */
exports.updateBlogEditor = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const editor = await User.findOne({ _id: req.params.id, role: 'blog_editor' });
    if (!editor) return res.status(404).json({ message: 'Blog editor not found' });

    if (email && email.toLowerCase() !== editor.email) {
      const exists = await User.findOne({ email: email.toLowerCase(), _id: { $ne: editor._id } });
      if (exists) return res.status(409).json({ message: 'Email already registered' });
      editor.email = email.toLowerCase();
    }
    if (name) editor.name = name;
    if (password) editor.password = password;

    await editor.save();
    res.json({ _id: editor._id, name: editor.name, email: editor.email, role: editor.role });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /api/admin/blog-editors/:id  (admin)
 */
exports.deleteBlogEditor = async (req, res) => {
  try {
    await User.findOneAndDelete({ _id: req.params.id, role: 'blog_editor' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const ADMIN_SCOPES = ['coordinator', 'product', 'leads', 'finance'];
const sanitizeAdminUser = (u) => ({ _id: u._id, name: u.name, email: u.email, role: u.role, adminScope: u.adminScope, isActive: u.isActive, createdAt: u.createdAt });

/**
 * POST /api/admin/admins  (admin)
 * Create a scoped admin account (Coordinator/Product/Leads/Finance).
 * Body: { name, email, password, adminScope }
 * adminScope must be one of ADMIN_SCOPES — this endpoint never creates
 * another unscoped (Super Admin-equivalent) account.
 */
exports.createAdminUser = async (req, res) => {
  try {
    const { name, email, password, adminScope } = req.body;
    if (!name || !email || !password || !adminScope)
      return res.status(400).json({ message: 'name, email, password, and adminScope are required' });
    if (!ADMIN_SCOPES.includes(adminScope))
      return res.status(400).json({ message: `adminScope must be one of: ${ADMIN_SCOPES.join(', ')}` });
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Email already registered' });
    const admin = await User.create({
      name, email: email.toLowerCase(), password,
      role: 'admin', adminScope, isActive: true,
    });
    res.status(201).json(sanitizeAdminUser(admin));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/admin/admins  (admin)
 * Lists scoped admin accounts only — the unscoped Super Admin account(s)
 * are not listed or manageable here.
 */
exports.listAdminUsers = async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin', adminScope: { $in: ADMIN_SCOPES } })
      .select('name email adminScope isActive createdAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json(admins);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/admin/admins/:id  (admin)
 * Body: { name?, email?, adminScope? }
 * Scoped to adminScope-tagged accounts only — cannot target an unscoped
 * (Super Admin) account through this endpoint.
 */
exports.updateAdminUser = async (req, res) => {
  try {
    const { name, email, adminScope } = req.body;
    const admin = await User.findOne({ _id: req.params.id, role: 'admin', adminScope: { $in: ADMIN_SCOPES } });
    if (!admin) return res.status(404).json({ message: 'Scoped admin account not found' });

    if (email && email.toLowerCase() !== admin.email) {
      const conflict = await User.findOne({ email: email.toLowerCase(), _id: { $ne: admin._id } });
      if (conflict) return res.status(409).json({ message: 'Email already in use' });
      admin.email = email.toLowerCase();
    }
    if (name) admin.name = name;
    if (adminScope) {
      if (!ADMIN_SCOPES.includes(adminScope))
        return res.status(400).json({ message: `adminScope must be one of: ${ADMIN_SCOPES.join(', ')}` });
      admin.adminScope = adminScope;
    }
    await admin.save();
    res.json(sanitizeAdminUser(admin));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/admin/admins/:id/toggle-active  (admin)
 */
exports.toggleAdminUserActive = async (req, res) => {
  try {
    const admin = await User.findOne({ _id: req.params.id, role: 'admin', adminScope: { $in: ADMIN_SCOPES } });
    if (!admin) return res.status(404).json({ message: 'Scoped admin account not found' });
    admin.isActive = !admin.isActive;
    await admin.save();
    res.json(sanitizeAdminUser(admin));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/admin/admins/:id/reset-password  (admin)
 * Body: { password }
 */
exports.resetAdminUserPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || String(password).trim().length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const admin = await User.findOne({ _id: req.params.id, role: 'admin', adminScope: { $in: ADMIN_SCOPES } });
    if (!admin) return res.status(404).json({ message: 'Scoped admin account not found' });
    admin.password = password;
    await admin.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /api/admin/admins/:id  (admin)
 * Scoped accounts only — an unscoped (Super Admin) account can never be
 * deleted through this endpoint, satisfying "cannot delete Super Admin
 * accounts" even before Phase 2's full backend enforcement lands.
 */
exports.deleteAdminUser = async (req, res) => {
  try {
    const deleted = await User.findOneAndDelete({ _id: req.params.id, role: 'admin', adminScope: { $in: ADMIN_SCOPES } });
    if (!deleted) return res.status(404).json({ message: 'Scoped admin account not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Agency Coordinator / Account Access (admin can also create these) ──────
// Same idea as the scoped admin accounts above, but for an agency's
// Coordinator/Account Access employees — admin picks which agency the
// account belongs to. Deliberately scoped to just these two employeeTypes:
// plain CPV/Sales staff stay the agency's own business (via /api/employees),
// not something admin manages.
const AGENCY_EMPLOYEE_TYPES = ['coordinator', 'account'];
const sanitizeAgencyEmployee = (u) => ({
  _id: u._id, name: u.name, email: u.email, role: u.role, employeeType: u.employeeType,
  agency: u.agency, isActive: u.isActive, createdAt: u.createdAt,
});

/**
 * POST /api/admin/agency-employees  (admin)
 * Body: { name, email, password, employeeType, agency }
 * employeeType must be 'coordinator' or 'account'; agency must be an
 * existing agency's user id.
 */
exports.createAgencyEmployee = async (req, res) => {
  try {
    const { name, email, password, employeeType, agency } = req.body;
    if (!name || !email || !password || !employeeType || !agency)
      return res.status(400).json({ message: 'name, email, password, employeeType, and agency are required' });
    if (!AGENCY_EMPLOYEE_TYPES.includes(employeeType))
      return res.status(400).json({ message: `employeeType must be one of: ${AGENCY_EMPLOYEE_TYPES.join(', ')}` });
    const agencyDoc = await User.findOne({ _id: agency, role: 'agency' });
    if (!agencyDoc) return res.status(404).json({ message: 'Agency not found' });
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: 'Email already registered' });

    const employee = await User.create({
      name, email: email.toLowerCase(), password,
      role: 'employee', employeeType, agency: agencyDoc._id, isActive: true,
    });
    res.status(201).json(sanitizeAgencyEmployee(employee));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/admin/agency-employees  (admin)
 * Optional ?agency=<id> to filter to one agency.
 */
exports.listAgencyEmployees = async (req, res) => {
  try {
    const filter = { role: 'employee', employeeType: { $in: AGENCY_EMPLOYEE_TYPES } };
    if (req.query.agency) filter.agency = req.query.agency;
    const employees = await User.find(filter)
      .select('name email employeeType agency isActive createdAt')
      .populate('agency', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    res.json(employees);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/admin/agency-employees/:id  (admin)
 * Body: { name?, email?, employeeType? }
 */
exports.updateAgencyEmployee = async (req, res) => {
  try {
    const { name, email, employeeType } = req.body;
    const employee = await User.findOne({ _id: req.params.id, role: 'employee', employeeType: { $in: AGENCY_EMPLOYEE_TYPES } });
    if (!employee) return res.status(404).json({ message: 'Agency employee not found' });

    if (email && email.toLowerCase() !== employee.email) {
      const conflict = await User.findOne({ email: email.toLowerCase(), _id: { $ne: employee._id } });
      if (conflict) return res.status(409).json({ message: 'Email already in use' });
      employee.email = email.toLowerCase();
    }
    if (name) employee.name = name;
    if (employeeType) {
      if (!AGENCY_EMPLOYEE_TYPES.includes(employeeType))
        return res.status(400).json({ message: `employeeType must be one of: ${AGENCY_EMPLOYEE_TYPES.join(', ')}` });
      employee.employeeType = employeeType;
    }
    await employee.save();
    res.json(sanitizeAgencyEmployee(employee));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/admin/agency-employees/:id/toggle-active  (admin)
 */
exports.toggleAgencyEmployeeActive = async (req, res) => {
  try {
    const employee = await User.findOne({ _id: req.params.id, role: 'employee', employeeType: { $in: AGENCY_EMPLOYEE_TYPES } });
    if (!employee) return res.status(404).json({ message: 'Agency employee not found' });
    employee.isActive = !employee.isActive;
    await employee.save();
    res.json(sanitizeAgencyEmployee(employee));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * PATCH /api/admin/agency-employees/:id/reset-password  (admin)
 * Body: { password }
 */
exports.resetAgencyEmployeePassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || String(password).trim().length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const employee = await User.findOne({ _id: req.params.id, role: 'employee', employeeType: { $in: AGENCY_EMPLOYEE_TYPES } });
    if (!employee) return res.status(404).json({ message: 'Agency employee not found' });
    employee.password = password;
    await employee.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /api/admin/agency-employees/:id  (admin)
 */
exports.deleteAgencyEmployee = async (req, res) => {
  try {
    const deleted = await User.findOneAndDelete({ _id: req.params.id, role: 'employee', employeeType: { $in: AGENCY_EMPLOYEE_TYPES } });
    if (!deleted) return res.status(404).json({ message: 'Agency employee not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
