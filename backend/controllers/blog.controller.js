const Blog = require('../models/Blog');
const { getFilename } = require('../middleware/upload.middleware');

const slugify = (t) =>
  t.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const buildSlug = async (title, excludeId) => {
  const base = slugify(title);
  let slug = base;
  let n = 1;
  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await Blog.findOne(query).lean();
    if (!exists) return slug;
    slug = `${base}-${n++}`;
  }
};

exports.list = async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ sortOrder: 1, publishedDate: -1 }).lean();
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { title, excerpt, content, category, publishedDate, readTime, iconType, isPublished, sortOrder, metaTitle, metaDescription, coverImageAlt } = req.body;
    const slug = await buildSlug(title);
    const files = req.files || {};
    const parsedDetailAlts = req.body.detailImageAlts ? JSON.parse(req.body.detailImageAlts) : [];
    const blog = await Blog.create({
      title, slug, excerpt, content, category, publishedDate, readTime, iconType,
      isPublished: isPublished === 'true' || isPublished === true,
      sortOrder: sortOrder || 0,
      coverImage:      files.coverImage?.[0] ? getFilename(files.coverImage[0]) : undefined,
      detailImages:    files.detailImages?.map(f => getFilename(f)) || [],
      detailImageAlts: parsedDetailAlts,
      createdBy: req.user._id,
      metaTitle:       metaTitle       || undefined,
      metaDescription: metaDescription || undefined,
      coverImageAlt:   coverImageAlt   || undefined,
    });
    res.status(201).json(blog);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { title, excerpt, content, category, publishedDate, readTime, iconType, isPublished, sortOrder, metaTitle, metaDescription, coverImageAlt } = req.body;
    const existing = await Blog.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Blog post not found' });

    if (title && title !== existing.title) {
      existing.slug = await buildSlug(title, existing._id);
    }
    existing.title        = title        ?? existing.title;
    existing.excerpt      = excerpt      ?? existing.excerpt;
    existing.content      = content      !== undefined ? content : existing.content;
    existing.category     = category     ?? existing.category;
    existing.publishedDate = publishedDate ?? existing.publishedDate;
    existing.readTime     = readTime     ?? existing.readTime;
    existing.iconType     = iconType     ?? existing.iconType;
    existing.sortOrder       = sortOrder    !== undefined ? sortOrder : existing.sortOrder;
    if (metaTitle       !== undefined) existing.metaTitle       = metaTitle;
    if (metaDescription !== undefined) existing.metaDescription = metaDescription;
    if (coverImageAlt   !== undefined) existing.coverImageAlt   = coverImageAlt;
    existing.isPublished  = isPublished !== undefined
      ? (isPublished === 'true' || isPublished === true)
      : existing.isPublished;
    const files = req.files || {};
    if (files.coverImage?.[0]) existing.coverImage = getFilename(files.coverImage[0]);
    // Merge kept existing images + any newly uploaded images
    if (req.body.keepDetailImages !== undefined || files.detailImages?.length) {
      let kept = req.body.keepDetailImages
        ? (Array.isArray(req.body.keepDetailImages) ? req.body.keepDetailImages : [req.body.keepDetailImages])
        : [];
      const uploaded = files.detailImages?.map(f => getFilename(f)) || [];
      existing.detailImages = [...kept, ...uploaded];
    }
    if (req.body.detailImageAlts !== undefined) {
      existing.detailImageAlts = JSON.parse(req.body.detailImageAlts);
    }

    await existing.save();
    res.json(existing);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) return res.status(404).json({ message: 'Blog post not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.listPublic = async (req, res) => {
  try {
    const blogs = await Blog.find({ isPublished: true })
      .sort({ sortOrder: 1, publishedDate: -1 })
      .select('-createdBy')
      .lean();
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug, isPublished: true })
      .select('-createdBy')
      .lean();
    if (!blog) return res.status(404).json({ message: 'Post not found' });
    res.json(blog);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
