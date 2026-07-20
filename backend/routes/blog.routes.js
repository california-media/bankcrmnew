const router = require('express').Router();
const ctrl   = require('../controllers/blog.controller');
const { protect, requireRole } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.use(protect, requireRole('admin', 'blog_editor'));
router.get('/',       ctrl.list);
const blogFields = upload.blogImages.fields([
  { name: 'coverImage',   maxCount: 1  },
  { name: 'detailImages', maxCount: 10 },
]);
router.post('/',      blogFields, ctrl.create);
router.put('/:id',    blogFields, ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
