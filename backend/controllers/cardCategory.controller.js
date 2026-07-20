const CardCategory = require('../models/CardCategory');

exports.list = async (req, res) => {
  try {
    const cats = await CardCategory.find().sort({ name: 1 }).lean();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name required' });
    const cat = await CardCategory.create({ name: name.trim() });
    res.status(201).json(cat);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Category already exists' });
    res.status(400).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { name } = req.body;
    const cat = await CardCategory.findById(req.params.id);
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    if (name?.trim()) cat.name = name.trim();
    await cat.save();
    res.json(cat);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Category already exists' });
    res.status(400).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const cat = await CardCategory.findByIdAndDelete(req.params.id);
    if (!cat) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
