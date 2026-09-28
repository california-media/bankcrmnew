const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Lead = require('../models/Lead');
const User = require('../models/User');
const CompanySettings = require('../models/CompanySettings');
const Counter = require('../models/Counter');
const { resolveAgencyId } = require('../middleware/auth.middleware');
const { createAndEmit } = require('../utils/notify');
const { renderInvoicePdf } = require('../services/invoicePdf.service');

// Line-item description for an invoice raised from a lead: what was sold —
// product type, bank and the card/loan/account name, e.g.
// "Credit Card — Emirates NBD — Titanium Card". Expects bank + product
// populated with `name`. Falls back to the lead number when the lead has
// no bank/product on it.
const PRODUCT_TYPE_LABELS = { credit_card: 'Credit Card', loan: 'Loan', account: 'Account' };
const leadLineDescription = (lead) => {
  const productName = lead.cardProduct?.name || lead.loanProduct?.name || lead.accountProduct?.name;
  const parts = [PRODUCT_TYPE_LABELS[lead.productType], lead.bank?.name, productName].filter(Boolean);
  return parts.length ? parts.join(' — ') : `Commission — Lead ${lead.leadNumber || lead._id}`;
};

// Older invoices were saved before line items carried leadNumber — fill it
// in from the invoice's lead(s) (populated with leadNumber + customerName):
// by position when there's one line per lead (lines are created in lead
// order) and the names agree, otherwise by a unique customer-name match.
const withLeadNumbers = (invoice) => {
  const leads = invoice.leads?.length ? invoice.leads : (invoice.lead ? [invoice.lead] : []);
  const items = invoice.lineItems || [];
  invoice.lineItems = items.map((li, i) => {
    if (li.leadNumber) return li;
    const byPosition = leads.length === items.length ? leads[i] : null;
    let match = byPosition && (!li.customerName || byPosition.customerName === li.customerName) ? byPosition : null;
    if (!match && li.customerName) {
      const byName = leads.filter((l) => l?.customerName && l.customerName === li.customerName);
      if (byName.length === 1) [match] = byName;
    }
    return match?.leadNumber ? { ...li, leadNumber: match.leadNumber } : li;
  });
  return invoice;
};

// Invoice numbers come from a per-year counter that only ever goes up, so a
// deleted invoice's number is never handed out again (a count-based number
// repeats after a delete and can collide with a later invoice). The counter
// is first raised to the highest number already in use.
const nextInvoiceNumber = async () => {
  const prefix = `INV-${new Date().getFullYear()}-`;
  const existing = await Invoice.find({ invoiceNumber: new RegExp(`^${prefix}\\d+$`) }).select('invoiceNumber').lean();
  const highest = existing.reduce((max, i) => Math.max(max, parseInt(i.invoiceNumber.slice(prefix.length), 10) || 0), 0);
  const key = `invoice-${prefix}`;
  await Counter.updateOne({ _id: key }, { $max: { seq: highest } }, { upsert: true });
  const { seq } = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { new: true });
  return `${prefix}${String(seq).padStart(4, '0')}`;
};

class InvoiceInputError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const sendError = (res, err) => {
  if (err instanceof InvoiceInputError) return res.status(err.status).json({ message: err.message });
  if (err.code === 11000) return res.status(409).json({ message: 'Invoice number collision, please retry' });
  if (err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).json({ message: err.message });
  return res.status(500).json({ message: err.message });
};

// A lead can be on only one live invoice at a time. Cancelled invoices don't
// count — cancelling (or deleting) an invoice puts its leads back in the pool.
const liveInvoiceWithLeads = (leadIds, excludeInvoiceId) => Invoice.findOne({
  status: { $ne: 'cancelled' },
  ...(excludeInvoiceId && { _id: { $ne: excludeInvoiceId } }),
  $or: [{ lead: { $in: leadIds } }, { leads: { $in: leadIds } }],
});

// Loads the selected leads in the order given (populated for the line-item
// description), checking they exist, belong to the agency and aren't on
// another live invoice.
const loadInvoiceLeads = async (rawLeadIds, agencyId, excludeInvoiceId) => {
  const leadIds = [...new Set((rawLeadIds || []).map(String))];
  if (!leadIds.length) return [];
  const leadDocs = await Lead.find({ _id: { $in: leadIds } })
    .populate('bank', 'name')
    .populate('cardProduct', 'name')
    .populate('loanProduct', 'name')
    .populate('accountProduct', 'name');
  if (leadDocs.length !== leadIds.length) throw new InvoiceInputError(404, 'One or more leads not found');
  const byId = new Map(leadDocs.map((d) => [String(d._id), d]));
  const ordered = leadIds.map((id) => byId.get(id));
  if (ordered.some((d) => String(d.agency) !== String(agencyId))) {
    throw new InvoiceInputError(400, 'All selected leads must belong to the selected agency');
  }
  const clash = await liveInvoiceWithLeads(leadIds, excludeInvoiceId);
  if (clash) throw new InvoiceInputError(409, `One of these leads is already invoiced (${clash.invoiceNumber})`);
  return ordered;
};

// The invoice-level lead reference(s): singular `lead` for one lead, the
// `leads` array for two or more, neither for a manual invoice.
const leadRefs = (leadDocs) => ({
  lead: leadDocs.length === 1 ? leadDocs[0]._id : undefined,
  leads: leadDocs.length > 1 ? leadDocs.map((d) => d._id) : undefined,
});

const resolveVatRate = async (raw) => {
  const vatRate = raw != null ? Number(raw) : (await CompanySettings.getSingleton()).vatRate;
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
    throw new InvoiceInputError(400, 'vatRate must be between 0 and 100');
  }
  return vatRate;
};

// Normalises line items (auto-filled from the leads when none are sent).
// VAT is a percentage of each line's subtotal, applied only when
// vatApplicable is on, and every amount is derived server-side — never
// trust a client-supplied total. A line is linked to a lead only when its
// leadNumber is one of the selected leads.
const buildLineItems = (rawItems, leadDocs, applyVat, vatRate) => {
  let items = rawItems;
  if ((!items || !items.length) && leadDocs.length) {
    items = leadDocs.map((leadDoc) => ({
      customerName: leadDoc.customerName || '',
      leadNumber: leadDoc.leadNumber || '',
      description: leadLineDescription(leadDoc),
      qty: 1,
      unitPrice: leadDoc.grossCommission || 0,
    }));
  }
  if (!items || !items.length) throw new InvoiceInputError(400, 'At least one line item is required');
  const badItem = items.find((li) => (
    !li.description || !String(li.description).trim()
    || !Number.isFinite(Number(li.unitPrice)) || Number(li.unitPrice) < 0
    || !Number.isFinite(Number(li.qty ?? 1)) || Number(li.qty ?? 1) < 1
  ));
  if (badItem) {
    throw new InvoiceInputError(400, 'Every line item needs a description, a quantity of at least 1, and a non-negative unit price');
  }
  const byLeadNumber = new Map(leadDocs.filter((d) => d.leadNumber).map((d) => [d.leadNumber, d]));
  const lineItems = items.map((li) => {
    const qty = Number(li.qty ?? 1);
    const unitPrice = Number(li.unitPrice);
    const lineSubtotal = qty * unitPrice;
    const vatAmount = applyVat ? Math.round(lineSubtotal * (vatRate / 100) * 100) / 100 : 0;
    const leadDoc = byLeadNumber.get(String(li.leadNumber || '').trim());
    return {
      lead: leadDoc?._id,
      customerName: li.customerName || '',
      leadNumber: leadDoc?.leadNumber,
      description: li.description,
      qty,
      unitPrice,
      vatAmount,
      amount: lineSubtotal + vatAmount,
    };
  });
  return { lineItems, amount: lineItems.reduce((sum, li) => sum + li.amount, 0) };
};

const INVOICE_POPULATE = [
  { path: 'agency', select: 'name email' },
  { path: 'createdBy', select: 'name email phone' },
  { path: 'lead', select: 'leadNumber customerName' },
  { path: 'leads', select: 'leadNumber customerName' },
];

// Admin: all invoices (optionally filtered by agency/status).
// Agency (+ its coordinator/account employees): only its own invoices.
exports.list = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== 'admin') {
      filter.agency = resolveAgencyId(req.user);
    } else {
      if (req.query.agency) filter.agency = req.query.agency;
    }
    if (req.query.status) filter.status = req.query.status;
    const invoices = await Invoice.find(filter)
      .populate('agency', 'name email')
      .populate('createdBy', 'name email phone')
      .populate('lead', 'leadNumber customerName')
      .populate('leads', 'leadNumber customerName')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin only: leads that can go on an invoice — approved or disbursed and not
// on a live (non-cancelled) invoice — to prefill the "raise from lead" form.
// With ?invoice=<id> (editing that invoice) its own leads are included too.
exports.suggestFromLeads = async (req, res) => {
  try {
    const editingId = mongoose.isValidObjectId(req.query.invoice) ? req.query.invoice : null;
    const liveFilter = { status: { $ne: 'cancelled' }, ...(editingId && { _id: { $ne: editingId } }) };
    const [invoicedSingle, invoicedMulti, editing] = await Promise.all([
      Invoice.distinct('lead', { ...liveFilter, lead: { $ne: null } }),
      Invoice.distinct('leads', { ...liveFilter, leads: { $ne: null } }),
      editingId ? Invoice.findById(editingId).select('lead leads').lean() : null,
    ]);
    const free = { status: { $in: ['approved', 'disbursed'] }, _id: { $nin: [...invoicedSingle, ...invoicedMulti] } };
    if (req.query.agency) free.agency = req.query.agency;
    const ownLeadIds = editing ? [editing.lead, ...(editing.leads || [])].filter(Boolean) : [];
    const leads = await Lead.find(ownLeadIds.length ? { $or: [free, { _id: { $in: ownLeadIds } }] } : free)
      .populate('agency', 'name email')
      .populate('bank', 'name')
      .populate('cardProduct', 'name')
      .populate('loanProduct', 'name')
      .populate('accountProduct', 'name')
      .select('leadNumber customerName agency grossCommission createdAt productType bank cardProduct loanProduct accountProduct')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin only: create — either from leads (lineItems auto-filled if omitted)
// or fully manual.
exports.create = async (req, res) => {
  try {
    const { agency, lead, leads, lineItems, notes, dueDays, paymentTermsDays, billTo, vatApplicable } = req.body;
    if (!agency) return res.status(400).json({ message: 'agency is required' });
    const agencyDoc = await User.findOne({ _id: agency, role: 'agency' });
    if (!agencyDoc) return res.status(404).json({ message: 'Agency not found' });

    // A single lead may come as the legacy singular `lead`; several as `leads`.
    const leadIds = Array.isArray(leads) && leads.length ? leads : (lead ? [lead] : []);
    const leadDocs = await loadInvoiceLeads(leadIds, agency);
    const vatRate = await resolveVatRate(req.body.vatRate);
    const { lineItems: finalLineItems, amount } = buildLineItems(lineItems, leadDocs, !!vatApplicable, vatRate);

    const invoice = await Invoice.create({
      agency,
      ...leadRefs(leadDocs),
      invoiceNumber: await nextInvoiceNumber(),
      lineItems: finalLineItems,
      amount,
      notes,
      dueDays,
      paymentTermsDays,
      billTo,
      vatApplicable: !!vatApplicable,
      vatRate,
      createdBy: req.user._id,
    });

    res.status(201).json(await invoice.populate(INVOICE_POPULATE));
  } catch (err) {
    sendError(res, err);
  }
};

// Admin only: edit any invoice (whatever its status). Same body as create
// except the agency, which stays fixed; invoice number, issue date and status
// don't change. Leads taken off the invoice go back to the pool; leads added
// must be free (not on another live invoice).
exports.update = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    const { leads, lineItems, notes, dueDays, paymentTermsDays, billTo, vatApplicable } = req.body;

    const leadDocs = await loadInvoiceLeads(Array.isArray(leads) ? leads : [], invoice.agency, invoice._id);
    const vatRate = await resolveVatRate(req.body.vatRate ?? invoice.vatRate);
    const { lineItems: finalLineItems, amount } = buildLineItems(lineItems, leadDocs, !!vatApplicable, vatRate);

    const refs = leadRefs(leadDocs);
    invoice.lead = refs.lead;
    invoice.leads = refs.leads;
    invoice.lineItems = finalLineItems;
    invoice.amount = amount;
    invoice.vatApplicable = !!vatApplicable;
    invoice.vatRate = vatRate;
    if (notes !== undefined) invoice.notes = notes;
    if (dueDays !== undefined) invoice.dueDays = dueDays;
    if (paymentTermsDays !== undefined) invoice.paymentTermsDays = paymentTermsDays;
    if (billTo !== undefined) invoice.billTo = billTo;
    await invoice.save();

    await invoice.populate(INVOICE_POPULATE);
    res.json(withLeadNumbers(invoice.toObject()));
  } catch (err) {
    if (err.name === 'CastError' && err.path === '_id') return res.status(404).json({ message: 'Invoice not found' });
    sendError(res, err);
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['unpaid', 'paid', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    // Cancelling put this invoice's leads back in the pool — un-cancelling
    // is refused if one of them has been billed again since.
    if (invoice.status === 'cancelled' && status !== 'cancelled') {
      const leadIds = [invoice.lead, ...(invoice.leads || [])].filter(Boolean);
      const clash = leadIds.length ? await liveInvoiceWithLeads(leadIds, invoice._id) : null;
      if (clash) {
        return res.status(409).json({ message: `A lead on this invoice is now on ${clash.invoiceNumber} — remove it from one of them first` });
      }
    }
    invoice.status = status;
    if (status === 'paid') invoice.paidAt = new Date();
    await invoice.save();
    res.json(await invoice.populate(INVOICE_POPULATE.slice(0, 2)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Deleting an invoice frees its leads: they're no longer on any invoice, so
// they show up in the pool again.
exports.remove = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin or the billed agency's owner login: add a note to the invoice's
// conversation. An agency note notifies the main admin account(s); an admin
// note notifies the agency.
exports.addComment = async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ message: 'Note cannot be empty' });
    if (text.length > 2000) return res.status(400).json({ message: 'Note is too long (max 2000 characters)' });
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (req.user.role === 'agency' && String(invoice.agency) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to add notes to this invoice' });
    }

    const authorName = req.user.name || req.user.email;
    invoice.comments.push({ author: req.user._id, authorName, authorRole: req.user.role, text });
    await invoice.save();

    try {
      const recipients = req.user.role === 'agency'
        ? (await User.find({ role: 'admin', adminScope: null }).select('_id').lean()).map((u) => u._id)
        : [invoice.agency];
      await createAndEmit(recipients, {
        type: 'invoice_note',
        title: `Note on ${invoice.invoiceNumber}`,
        body: `${authorName}: ${text.length > 140 ? `${text.slice(0, 140)}…` : text}`,
        invoice: invoice._id,
        noCoordinatorCopy: true,
      }, req.user._id);
    } catch (_) {}

    res.status(201).json({ comments: invoice.comments });
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ message: 'Invoice not found' });
    res.status(500).json({ message: err.message });
  }
};

// Admin: any invoice. Agency (+coordinator/account): only its own.
// Backs the full-page "View" tab (opened separately from the list/modal).
exports.getOne = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('agency', 'name email')
      .populate('createdBy', 'name email phone')
      .populate('lead', 'leadNumber customerName')
      .populate('leads', 'leadNumber customerName');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (req.user.role !== 'admin' && String(invoice.agency?._id) !== String(resolveAgencyId(req.user))) {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }
    const companySettings = await CompanySettings.getSingleton();
    res.json({ ...withLeadNumbers(invoice.toObject()), companySettings });
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ message: 'Invoice not found' });
    res.status(500).json({ message: err.message });
  }
};

// Admin: any invoice. Agency (+coordinator/account): only its own.
exports.downloadPdf = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('agency', 'name email')
      .populate('createdBy', 'name email phone')
      .populate('lead', 'leadNumber customerName')
      .populate('leads', 'leadNumber customerName');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (req.user.role !== 'admin' && String(invoice.agency?._id) !== String(resolveAgencyId(req.user))) {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }
    const companySettings = await CompanySettings.getSingleton();
    renderInvoicePdf(withLeadNumbers(invoice.toObject()), res, companySettings);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ message: 'Invoice not found' });
    res.status(500).json({ message: err.message });
  }
};
