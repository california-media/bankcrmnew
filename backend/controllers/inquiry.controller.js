const SiteInquiry = require('../models/SiteInquiry');
const { sendInquiryNotification, sendInquiryConfirmation } = require('../utils/email');

exports.submit = async (req, res) => {
  try {
    const { name, email, phone, companyName, message, queryType } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Name and email required' });
    // Older copies of the website form don't send a type — treat those as a general query
    const type = queryType === undefined || queryType === '' ? 'general' : queryType;
    if (!['general', 'support'].includes(type)) {
      return res.status(400).json({ message: 'Query type must be general or support' });
    }

    const inquiry = await SiteInquiry.create({ name, email, phone, companyName, message, queryType: type });

    sendInquiryNotification({ name, email, phone, companyName, message, queryType: type }).catch((err) =>
      console.error('[inquiry email]', err.message)
    );
    sendInquiryConfirmation({ name, email }).catch((err) =>
      console.error('[inquiry confirmation]', err.message)
    );

    res.status(201).json({ ok: true, id: inquiry._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.list = async (req, res) => {
  try {
    const { read } = req.query;
    const filter = {};
    if (read === 'true') filter.read = true;
    if (read === 'false') filter.read = false;

    const inquiries = await SiteInquiry.find(filter).sort({ createdAt: -1 });
    res.json(inquiries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const inquiry = await SiteInquiry.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    if (!inquiry) return res.status(404).json({ message: 'Not found' });
    res.json(inquiry);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteInquiry = async (req, res) => {
  try {
    await SiteInquiry.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
