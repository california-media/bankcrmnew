const mongoose = require('mongoose');

const siteInquirySchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    email:       { type: String, required: true, trim: true },
    phone:       { type: String, trim: true },
    companyName: { type: String, trim: true },
    queryType:   { type: String, enum: ['general', 'support', 'other'], default: 'general' },
    message:     { type: String, trim: true },
    read:        { type: Boolean, default: false },
    // Email replies sent from the admin panel (admin / admin coordinator)
    replies: [
      {
        subject:  { type: String, trim: true },
        body:     { type: String, trim: true },  // plain-text copy
        bodyHtml: { type: String },               // sanitized rich text (older replies: none)
        to:       { type: [String], default: undefined }, // older replies: the requester
        cc:       { type: [String], default: [] },
        bcc:      { type: [String], default: [] },
        attachments: [
          {
            _id: false,
            filename:     String,  // S3 inquiry-reply-files/<filename>; empty if storing failed
            originalName: String,
            mimeType:     String,
            size:         Number,
          },
        ],
        sentBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        sentAt:  { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteInquiry', siteInquirySchema);
