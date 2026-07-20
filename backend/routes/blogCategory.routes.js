const router = require('express').Router();
const ctrl   = require('../controllers/blogCategory.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect, requireRole('admin', 'blog_editor'));
router.get('/',       ctrl.list);
router.post('/',      upload.blogCategoryImages.single('image'), ctrl.create);
router.put('/:id',    upload.blogCategoryImages.single('image'), ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
