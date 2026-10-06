const SupportTicket = require('../models/SupportTicket');
const Counter = require('../models/Counter');
const { getAdminIds, createAndEmit } = require('../utils/notify');
const { getFilename } = require('../middleware/upload.middleware');

const isStaff = (user) => user.role === 'admin';

const POPULATE = [
  { path: 'createdBy', select: 'name email role isSuperAgent' },
  { path: 'messages.sender', select: 'name email role' },
];

const nextTicketNumber = async () => {
  const c = await Counter.findOneAndUpdate({ _id: 'support-ticket' }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `TKT-${String(c.seq).padStart(5, '0')}`;
};

const toAttachments = (files = []) =>
  files.map((f) => ({ filename: getFilename(f), originalName: f.originalname, mimeType: f.mimetype }));

// Owner sees their own tickets only; staff (admin / admin coordinator) see all.
const loadAccessible = async (req) => {
  const filter = { _id: req.params.id };
  if (!isStaff(req.user)) filter.createdBy = req.user._id;
  return SupportTicket.findOne(filter);
};

/** POST /api/support-tickets  (any role) — multipart: subject, message, files[] */
exports.create = async (req, res) => {
  try {
    if (isStaff(req.user)) return res.status(403).json({ message: 'Staff reply to tickets, they do not raise them' });
    const subject = String(req.body.subject || '').trim();
    const text = String(req.body.message || '').trim();
    const attachments = toAttachments(req.files);
    if (!subject) return res.status(400).json({ message: 'Subject is required' });
    if (!text && !attachments.length) return res.status(400).json({ message: 'Message or attachment is required' });

    const ticket = await SupportTicket.create({
      ticketNumber: await nextTicketNumber(),
      subject,
      createdBy: req.user._id,
      messages: [{ sender: req.user._id, senderRole: req.user.role, isStaff: false, text, attachments }],
      unreadByStaff: true,
      unreadByOwner: false,
    });

    try {
      await createAndEmit(await getAdminIds(), {
        type: 'support_ticket',
        title: 'New Support Ticket',
        body: `${ticket.ticketNumber} — ${subject}`,
      }, req.user._id);
    } catch (_) {}

    res.status(201).json(await ticket.populate(POPULATE));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** GET /api/support-tickets  — own tickets, or all for staff */
exports.list = async (req, res) => {
  try {
    const filter = isStaff(req.user) ? {} : { createdBy: req.user._id };
    if (req.query.status) filter.status = req.query.status;
    const tickets = await SupportTicket.find(filter)
      .select('-messages.attachments')
      .populate('createdBy', 'name email role isSuperAgent')
      .sort({ lastMessageAt: -1 })
      .lean();
    res.json(tickets.map((t) => ({
      ...t,
      messageCount: t.messages.length,
      lastMessage: t.messages[t.messages.length - 1]?.text || '',
      messages: undefined,
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** GET /api/support-tickets/:id */
exports.getOne = async (req, res) => {
  try {
    const ticket = await loadAccessible(req);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    const flag = isStaff(req.user) ? 'unreadByStaff' : 'unreadByOwner';
    if (ticket[flag]) {
      ticket[flag] = false;
      await ticket.save();
    }
    res.json(await ticket.populate(POPULATE));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** POST /api/support-tickets/:id/messages — multipart: message, files[] */
exports.reply = async (req, res) => {
  try {
    const ticket = await loadAccessible(req);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (ticket.status === 'closed' && !isStaff(req.user)) {
      return res.status(400).json({ message: 'This ticket is closed' });
    }
    const text = String(req.body.message || '').trim();
    const attachments = toAttachments(req.files);
    if (!text && !attachments.length) return res.status(400).json({ message: 'Message or attachment is required' });

    const staff = isStaff(req.user);
    ticket.messages.push({ sender: req.user._id, senderRole: req.user.role, isStaff: staff, text, attachments });
    ticket.lastMessageAt = new Date();
    if (staff) {
      ticket.unreadByOwner = true;
    } else {
      ticket.unreadByStaff = true;
      if (ticket.status === 'closed') ticket.status = 'open';
    }
    await ticket.save();

    try {
      const recipients = staff ? [String(ticket.createdBy)] : await getAdminIds();
      await createAndEmit(recipients, {
        type: 'support_ticket',
        title: staff ? 'Support Replied' : 'Ticket Reply',
        body: `${ticket.ticketNumber} — ${ticket.subject}`,
      }, req.user._id);
    } catch (_) {}

    res.json(await ticket.populate(POPULATE));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** PATCH /api/support-tickets/:id/status  (staff) body: { status } */
exports.setStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['open', 'closed'].includes(status)) return res.status(400).json({ message: 'status must be open or closed' });
    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    ticket.status = status;
    await ticket.save();
    res.json(await ticket.populate(POPULATE));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
