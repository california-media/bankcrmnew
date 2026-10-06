const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String },
    mimeType: { type: String },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String },
    // true when the sender is staff (admin / admin coordinator) replying to the ticket owner
    isStaff: { type: Boolean, default: false },
    text: { type: String, trim: true, default: '' },
    attachments: { type: [attachmentSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, unique: true, sparse: true },
    subject: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open' },
    messages: { type: [messageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now },
    // unread flags per side
    unreadByStaff: { type: Boolean, default: true },
    unreadByOwner: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
