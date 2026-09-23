const Invoice = require('../models/Invoice');
const Lead = require('../models/Lead');
const User = require('../models/User');
const CompanySettings = require('../models/CompanySettings');
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
      .populate('createdBy', 'name email phone')
      .populate('lead', 'leadNumber customerName')
      .populate('leads', 'leadNumber customerName')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin only: leads eligible to be auto-suggested as an invoice (approved
// or disbursed, not already invoiced), to prefill the "raise from lead" form.
exports.suggestFromLeads = async (req, res) => {
  try {
    const filter = { status: { $in: ['approved', 'disbursed'] } };
    if (req.query.agency) filter.agency = req.query.agency;
    const [invoicedSingle, invoicedMulti] = await Promise.all([
      Invoice.distinct('lead', { lead: { $ne: null } }),
      Invoice.distinct('leads', { leads: { $ne: null } }),
    ]);
    filter._id = { $nin: [...invoicedSingle, ...invoicedMulti] };
    const leads = await Lead.find(filter)
      .populate('agency', 'name email')
      .populate('cardProduct', 'name')
      .populate('loanProduct', 'name')
      .populate('accountProduct', 'name')
      .select('leadNumber customerName agency grossCommission createdAt productType cardProduct loanProduct accountProduct')
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
    const { agency, lead, leads, lineItems, notes, dueDays, paymentTermsDays, billTo, vatApplicable } = req.body;
    if (!agency) return res.status(400).json({ message: 'agency is required' });
    const agencyDoc = await User.findOne({ _id: agency, role: 'agency' });
    if (!agencyDoc) return res.status(404).json({ message: 'Agency not found' });

    // A single lead uses the legacy singular `lead` ref; two or more use the
    // `leads` array — either way, one invoice can now cover multiple leads.
    const leadIds = Array.isArray(leads) && leads.length ? leads : (lead ? [lead] : []);

    let finalLineItems = lineItems;
    if (leadIds.length) {
      const leadDocs = await Lead.find({ _id: { $in: leadIds } });
      if (leadDocs.length !== leadIds.length) {
        return res.status(404).json({ message: 'One or more leads not found' });
      }
      const byId = new Map(leadDocs.map((d) => [String(d._id), d]));
      const orderedLeadDocs = leadIds.map((id) => byId.get(String(id)));
      const mismatched = orderedLeadDocs.find((d) => String(d.agency) !== String(agency));
      if (mismatched) {
        return res.status(400).json({ message: 'All selected leads must belong to the selected agency' });
      }
      // Guard against a double-click/double-submit, or picking a lead that's
      // already on another invoice (singular `lead` or inside a `leads` array).
      const existing = await Invoice.findOne({
        status: { $ne: 'cancelled' },
        $or: [{ lead: { $in: leadIds } }, { leads: { $in: leadIds } }],
      });
      if (existing) {
        return res.status(409).json({ message: `One of these leads is already invoiced (${existing.invoiceNumber})` });
      }
      if (!finalLineItems || !finalLineItems.length) {
        finalLineItems = orderedLeadDocs.map((leadDoc) => ({
          customerName: leadDoc.customerName || '',
          description: `Commission — Lead ${leadDoc.leadNumber || leadDoc._id}`,
          qty: 1,
          unitPrice: leadDoc.grossCommission || 0,
        }));
      }
    }

    if (!finalLineItems || !finalLineItems.length) {
      return res.status(400).json({ message: 'At least one line item is required' });
    }
    const badItem = finalLineItems.find((li) => (
      !li.description || !String(li.description).trim()
      || !Number.isFinite(Number(li.unitPrice)) || Number(li.unitPrice) < 0
      || !Number.isFinite(Number(li.qty ?? 1)) || Number(li.qty ?? 1) < 1
    ));
    if (badItem) {
      return res.status(400).json({ message: 'Every line item needs a description, a quantity of at least 1, and a non-negative unit price' });
    }

    // VAT is a percentage of each line's subtotal, applied only when
    // vatApplicable is on — never typed in by hand, so it can't drift from
    // qty*unitPrice*rate.
    const settings = await CompanySettings.getSingleton();
    const vatRate = req.body.vatRate != null ? Number(req.body.vatRate) : settings.vatRate;
    if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
      return res.status(400).json({ message: 'vatRate must be between 0 and 100' });
    }
    const applyVat = !!vatApplicable;

    // amount is always derived server-side — never trust a client-supplied total.
    finalLineItems = finalLineItems.map((li) => {
      const qty = Number(li.qty ?? 1);
      const unitPrice = Number(li.unitPrice);
      const lineSubtotal = qty * unitPrice;
      const vatAmount = applyVat ? Math.round(lineSubtotal * (vatRate / 100) * 100) / 100 : 0;
      return {
        customerName: li.customerName || '',
        description: li.description,
        qty,
        unitPrice,
        vatAmount,
        amount: lineSubtotal + vatAmount,
      };
    });

    const amount = finalLineItems.reduce((sum, li) => sum + li.amount, 0);
    const invoiceNumber = await nextInvoiceNumber();

    const invoice = await Invoice.create({
      agency,
      lead: leadIds.length === 1 ? leadIds[0] : undefined,
      leads: leadIds.length > 1 ? leadIds : undefined,
      invoiceNumber,
      lineItems: finalLineItems,
      amount,
      notes,
      dueDays,
      paymentTermsDays,
      billTo,
      vatApplicable: applyVat,
      vatRate,
      createdBy: req.user._id,
    });

    const populated = await invoice.populate([
      { path: 'agency', select: 'name email' },
      { path: 'createdBy', select: 'name email phone' },
      { path: 'lead', select: 'leadNumber customerName' },
      { path: 'leads', select: 'leadNumber customerName' },
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
      .populate('createdBy', 'name email phone');
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
      .populate('createdBy', 'name email phone')
      .populate('lead', 'leadNumber customerName')
      .populate('leads', 'leadNumber customerName');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (req.user.role !== 'admin' && String(invoice.agency?._id) !== String(resolveAgencyId(req.user))) {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }
    const companySettings = await CompanySettings.getSingleton();
    res.json({ ...invoice.toObject(), companySettings });
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
      .populate('lead', 'leadNumber')
      .populate('leads', 'leadNumber');
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (req.user.role !== 'admin' && String(invoice.agency?._id) !== String(resolveAgencyId(req.user))) {
      return res.status(403).json({ message: 'Not authorized to view this invoice' });
    }
    const companySettings = await CompanySettings.getSingleton();
    renderInvoicePdf(invoice, res, companySettings);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ message: 'Invoice not found' });
    res.status(500).json({ message: err.message });
  }
};
