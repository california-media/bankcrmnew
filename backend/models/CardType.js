const mongoose = require('mongoose');

// Admin-managed list of card types. Cards store the key (CardProduct.cardTypes);
// the key never changes, so renaming a type only changes its label.
const cardTypeSchema = new mongoose.Schema(
  {
    key:   { type: String, required: true, trim: true, unique: true },
    label: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CardType', cardTypeSchema);
