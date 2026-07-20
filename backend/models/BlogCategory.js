const mongoose = require('mongoose');

const blogCategorySchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, trim: true },
    color: {
      type: String,
      default: 'violet',
      enum: ['violet', 'blue', 'green', 'orange', 'teal', 'red', 'pink'],
    },
    image: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BlogCategory', blogCategorySchema);
