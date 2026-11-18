const upload = require('../middleware/upload.middleware');
const cache = require('./publicCardCache');

/**
 * Picture handlers for loan and account products (card products keep their
 * own `cardImage`). The picture is uploaded on its own, after the product is
 * saved, so the product forms keep sending plain JSON.
 * Stored as a filename in `productImage`; the file lives in S3 under `subdir`.
 */
module.exports = function productImageHandlers(Model, subdir, populate, notFoundMessage) {
  const deleteImage = (filename) => upload.deleteFromS3(subdir, filename);

  const uploadImage = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
    const filename = upload.getFilename(req.file);
    try {
      const existing = await Model.findById(req.params.id).select('productImage');
      if (!existing) {
        deleteImage(filename);
        return res.status(404).json({ message: notFoundMessage });
      }
      const product = await Model.findByIdAndUpdate(req.params.id, { $set: { productImage: filename } }, { new: true }).populate(populate);
      if (existing.productImage && existing.productImage !== filename) deleteImage(existing.productImage);
      cache.notifyWebsiteProductsChanged();
      res.json(product);
    } catch (err) {
      deleteImage(filename);
      res.status(500).json({ message: err.message });
    }
  };

  const removeImage = async (req, res) => {
    try {
      const existing = await Model.findById(req.params.id).select('productImage');
      if (!existing) return res.status(404).json({ message: notFoundMessage });
      const product = await Model.findByIdAndUpdate(req.params.id, { $unset: { productImage: 1 } }, { new: true }).populate(populate);
      if (existing.productImage) deleteImage(existing.productImage);
      cache.notifyWebsiteProductsChanged();
      res.json(product);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };

  return { uploadImage, removeImage, deleteImage };
};
