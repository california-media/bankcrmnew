const router = require('express').Router();
const ctrl = require('../controllers/featuredProduct.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect, requireRole('admin'));

router.get('/', ctrl.list);
router.post('/reorder', ctrl.reorder);
router.post('/:id/duplicate', ctrl.duplicate);
router.post('/', upload.featuredProductImages.single('image'), ctrl.create);
router.put('/:id', upload.featuredProductImages.single('image'), ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
