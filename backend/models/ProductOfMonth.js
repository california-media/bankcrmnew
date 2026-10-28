const mongoose = require('mongoose');

// Singleton — admin-picked "Product of the month" carousel shown on the app Home.
const productOfMonthSchema = new mongoose.Schema(
  {
    items: {
      type: [
        new mongoose.Schema(
          {
            productType: { type: String, enum: ['credit_card', 'loan', 'account'], required: true },
            product: { type: mongoose.Schema.Types.ObjectId, required: true },
            tagline: { type: String, trim: true, maxlength: 80, default: '' },
          },
          { _id: false }
        ),
      ],
      default: [],
      validate: { validator: (v) => v.length <= 6, message: 'At most 6 products' },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

productOfMonthSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) doc = new this({});
  if (doc.isNew || doc.isModified()) await doc.save();
  return doc;
};

module.exports = mongoose.model('ProductOfMonth', productOfMonthSchema);
