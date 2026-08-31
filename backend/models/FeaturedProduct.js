const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema(
  {
    icon: { type: String, enum: ['lifestyle', 'travel', 'card', 'document'], default: 'card' },
    title: { type: String, required: true, trim: true },
    bullets: { type: [String], default: [] },
  },
  { _id: false }
);

const feesSectionSchema = new mongoose.Schema(
  {
    icon: { type: String, enum: ['lifestyle', 'travel', 'card', 'document'], default: 'card' },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ['bullets', 'table'], default: 'bullets' },
    bullets: { type: [String], default: [] },
    rows: {
      type: [{
        label: { type: String, trim: true },
        value: { type: String, trim: true },
        _id: false,
      }],
      default: [],
    },
  },
  { _id: false }
);

const featuredProductSchema = new mongoose.Schema(
  {
    bankName: { type: String, required: true, trim: true },
    rankLabel: { type: String, trim: true, default: '' },
    productTitle: { type: String, required: true, trim: true },
    image: { type: String, trim: true },
    promoText: { type: String, trim: true, default: '' },
    promoColor: { type: String, trim: true, default: '' },
    modalPromoText: { type: String, trim: true, default: '' },
    stat1Label: { type: String, trim: true, default: '' },
    stat1Value: { type: String, trim: true, default: '' },
    stat2Label: { type: String, trim: true, default: '' },
    stat2Value: { type: String, trim: true, default: '' },
    tagline: { type: String, trim: true, default: '' },
    referUrl: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 },
    isVisible: { type: Boolean, default: true },
    benefitSections: { type: [sectionSchema], default: [] },
    feesSections: { type: [feesSectionSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FeaturedProduct', featuredProductSchema);
