const FeaturedProduct = require('../models/FeaturedProduct');
const { getFilename, deleteFromS3, copyInS3 } = require('../middleware/upload.middleware');

const deleteImage = (filename) => deleteFromS3('featured-products', filename);

const parseJsonField = (raw, fallback) => {
  if (raw === undefined) return fallback;
  if (typeof raw === 'string') return JSON.parse(raw);
  return raw;
};

exports.list = async (req, res) => {
  try {
    const products = await FeaturedProduct.find().sort({ order: 1, createdAt: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { bankName, productTitle } = req.body;
    if (!bankName || !productTitle) {
      if (req.file) deleteImage(getFilename(req.file));
      return res.status(400).json({ message: 'bankName and productTitle are required' });
    }

    const product = await FeaturedProduct.create({
      bankName,
      productTitle,
      rankLabel: req.body.rankLabel || '',
      promoText: req.body.promoText || '',
      promoColor: req.body.promoColor || '',
      modalPromoText: req.body.modalPromoText || '',
      stat1Label: req.body.stat1Label || '',
      stat1Value: req.body.stat1Value || '',
      stat2Label: req.body.stat2Label || '',
      stat2Value: req.body.stat2Value || '',
      tagline: req.body.tagline || '',
      referUrl: req.body.referUrl || '',
      order: req.body.order ? Number(req.body.order) : 0,
      isVisible: req.body.isVisible === undefined ? true : req.body.isVisible !== 'false' && req.body.isVisible !== false,
      benefitSections: parseJsonField(req.body.benefitSections, []),
      feesSections: parseJsonField(req.body.feesSections, []),
      image: req.file ? getFilename(req.file) : undefined,
    });
    res.status(201).json(product);
  } catch (err) {
    if (req.file) deleteImage(getFilename(req.file));
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const update = {};
    const strFields = [
      'bankName', 'productTitle', 'rankLabel', 'promoText', 'promoColor', 'modalPromoText',
      'stat1Label', 'stat1Value', 'stat2Label', 'stat2Value', 'tagline', 'referUrl',
    ];
    strFields.forEach((f) => {
      if (req.body[f] !== undefined) update[f] = req.body[f] || '';
    });
    if (req.body.order !== undefined) update.order = Number(req.body.order) || 0;
    if (req.body.isVisible !== undefined) update.isVisible = req.body.isVisible !== 'false' && req.body.isVisible !== false;
    if (req.body.benefitSections !== undefined) update.benefitSections = parseJsonField(req.body.benefitSections, []);
    if (req.body.feesSections !== undefined) update.feesSections = parseJsonField(req.body.feesSections, []);

    if (req.file) {
      const existing = await FeaturedProduct.findById(req.params.id, 'image');
      if (existing?.image) deleteImage(existing.image);
      update.image = getFilename(req.file);
    }

    const product = await FeaturedProduct.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!product) {
      if (req.file) deleteImage(getFilename(req.file));
      return res.status(404).json({ message: 'Featured product not found' });
    }
    res.json(product);
  } catch (err) {
    if (req.file) deleteImage(getFilename(req.file));
    res.status(500).json({ message: err.message });
  }
};

exports.reorder = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: 'ids array is required' });
    }
    await Promise.all(ids.map((id, index) => FeaturedProduct.findByIdAndUpdate(id, { order: index })));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.duplicate = async (req, res) => {
  try {
    const source = await FeaturedProduct.findById(req.params.id).lean();
    if (!source) return res.status(404).json({ message: 'Featured product not found' });

    const image = source.image ? await copyInS3('featured-products', source.image) : undefined;

    delete source._id;
    delete source.createdAt;
    delete source.updatedAt;
    delete source.__v;

    const copy = await FeaturedProduct.create({
      ...source,
      productTitle: `${source.productTitle} (Copy)`,
      image,
      isVisible: false,
    });
    res.status(201).json(copy);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const product = await FeaturedProduct.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Featured product not found' });
    if (product.image) deleteImage(product.image);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
