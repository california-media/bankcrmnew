const Invoice = require('../models/Invoice');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { resolveAgencyId } = require('../middleware/auth.middleware');
const { renderInvoicePdf } = require('../services/invoicePdf.service');

const nextInvoiceNumber = async () => {
  const count = await Invoice.countDocuments();
  return `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
};

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
      .populate('createdBy', 'name email')
      .populate('lead', 'leadNumber customerName')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin only: leads eligible to be auto-suggested as an invoice (disbursed,
// not already invoiced), to prefill the "raise from lead" form.
exports.suggestFromLeads = async (req, res) => {
  try {
    const filter = { status: 'disbursed' };
    if (req.query.agency) filter.agency = req.query.agency;
    const invoicedLeadIds = await Invoice.distinct('lead', { lead: { $ne: null } });
    filter._id = { $nin: invoicedLeadIds };
    const leads = await Lead.find(filter)
      .populate('agency', 'name email')
      .select('leadNumber customerName agency grossCommission createdAt')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(leads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin only: create — either from a lead (lineItems auto-filled if omitted)
// or fully manual.
exports.create = async (req, res) => {
  try {
    const { agency, lead, lineItems, notes } = req.body;
    if (!agency) return res.status(400).json({ message: 'agency is required' });
    const agencyDoc = await User.findOne({ _id: agency, role: 'agency' });
    if (!agencyDoc) return res.status(404).json({ message: 'Agency not found' });

    let finalLineItems = lineItems;
    let leadDoc = null;
    if (lead) {
      leadDoc = await Lead.findById(lead);
      if (!leadDoc) return res.status(404).json({ message: 'Lead not found' });
      if (String(leadDoc.agency) !== String(agency)) {
        return res.status(400).json({ message: 'This lead does not belong to the selected agency' });
      }
      // Guard against a double-click/double-submit raising two invoices for
      // the same lead (no DB-level unique constraint on `lead`, since manual
      // invoices legitimately have none).
      const existing = await Invoice.findOne({ lead, status: { $ne: 'cancelled' } });
      if (existing) {
        return res.status(409).json({ message: `This lead is already invoiced (${existing.invoiceNumber})` });
      }
      if (!finalLineItems || !finalLineItems.length) {
        finalLineItems = [{
          description: `Commission — Lead ${leadDoc.leadNumber || leadDoc._id} (${leadDoc.customerName})`,
          amount: leadDoc.grossCommission || 0,
        }];
      }
    }

    if (!finalLineItems || !finalLineItems.length) {
      return res.status(400).json({ message: 'At least one line item is required' });
    }
    const badItem = finalLineItems.find(
      (li) => !li.description || !String(li.description).trim() || !Number.isFinite(Number(li.amount)) || Number(li.amount) < 0
    );
    if (badItem) {
      return res.status(400).json({ message: 'Every line item needs a description and a non-negative amount' });
    }

    const amount = finalLineItems.reduce((sum, li) => sum + Number(li.amount), 0);
    const invoiceNumber = await nextInvoiceNumber();

    const invoice = await Invoice.create({
      agency,
      lead: lead || undefined,
      invoiceNumber,
      lineItems: finalLineItems,
      amount,
      notes,
      createdBy: req.user._id,
    });

    const populated = await invoice.populate([
      { path: 'agency', select: 'name email' },
      { path: 'createdBy', select: 'name email' },
      { path: 'lead', select: 'leadNumber customerName' },
    ]);
    res.status(201).json(populated);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Invoice number collision, please retry' });
    if (err.name === 'ValidationError' || err.name === 'CastError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['unpaid', 'paid', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const update = { status };
    if (status === 'paid') update.paidAt = new Date();
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('agency', 'name email')
      .populate('createdBy', 'name email');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: any invoice. Agency (+coordinator/account): only its own.
// Backs the full-page "View" tab (opened separately from the list/modal).
exports.getOne = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('agency', 'name email')
      .populate('createdBy', 'name email')
      .populate('lead', 'leadNumber customerName');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (req.user.role !== 'admin' && String(invoice.agency?._id) !== String(resolveAgencyId(req.user))) {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }
    res.json(invoice);
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
      .populate('lead', 'leadNumber');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (req.user.role !== 'admin' && String(invoice.agency?._id) !== String(resolveAgencyId(req.user))) {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }
    renderInvoicePdf(invoice, res);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ message: 'Invoice not found' });
    res.status(500).json({ message: err.message });
  }
};
