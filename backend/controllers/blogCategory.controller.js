const BlogCategory = require('../models/BlogCategory');
const { getFilename, deleteFromS3 } = require('../middleware/upload.middleware');

exports.list = async (req, res) => {
  try {
    const cats = await BlogCategory.find().sort({ name: 1 }).lean();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name required' });
    const cat = await BlogCategory.create({
      name:  name.trim(),
      color: color || 'violet',
      image: req.file ? getFilename(req.file) : undefined,
    });
    res.status(201).json(cat);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, color } = req.body;
    const cat = await BlogCategory.findById(req.params.id);
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    if (name?.trim()) cat.name = name.trim();
    if (color) cat.color = color;
    if (req.file) {
      if (cat.image) deleteFromS3('blog-category-images', cat.image);
      cat.image = getFilename(req.file);
    }
    await cat.save();
    res.json(cat);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const cat = await BlogCategory.findByIdAndDelete(req.params.id);
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    if (cat.image) deleteFromS3('blog-category-images', cat.image);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
