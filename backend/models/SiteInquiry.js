const mongoose = require('mongoose');

const siteInquirySchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    email:       { type: String, required: true, trim: true },
    phone:       { type: String, trim: true },
    companyName: { type: String, trim: true },
    message:     { type: String, trim: true },
    read:        { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteInquiry', siteInquirySchema);
