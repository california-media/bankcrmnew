const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema(
  {
    title:            { type: String, required: true, trim: true },
    slug:             { type: String, unique: true, sparse: true, trim: true },
    excerpt:          { type: String, required: true, trim: true },
    metaTitle:        { type: String, trim: true },
    metaDescription:  { type: String, trim: true },
    coverImageAlt:    { type: String, trim: true },
    content:       { type: String, default: '' },
    coverImage:    { type: String },
    detailImages:     { type: [String], default: [] },
    detailImageAlts:  { type: [String], default: [] },
    category:      { type: String, required: true, trim: true },
    publishedDate: { type: Date, default: Date.now },
    readTime:      { type: Number, min: 1, max: 60, default: 3 },
    iconType:      {
      type: String,
      enum: ['pen', 'chart', 'shield', 'star', 'document', 'rocket', 'lightbulb'],
      default: 'pen',
    },
    isPublished:   { type: Boolean, default: false },
    sortOrder:     { type: Number, default: 0 },
    createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

blogSchema.index({ isPublished: 1, publishedDate: -1 });

module.exports = mongoose.model('Blog', blogSchema);
