const SaraVideo = require('../models/SaraVideo');

// youtube.com/watch?v=, youtu.be/, youtube.com/shorts|embed|live/ (with or without www./m.)
const YOUTUBE_RE = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)[\w-]{11}/i;

// Playlist order: sort order, then oldest first.
const ORDER = { sortOrder: 1, createdAt: 1 };

const readFields = (body, { partial }) => {
  const data = {};
  if (body.title !== undefined || !partial) {
    const title = String(body.title ?? '').trim();
    if (!title) return { error: 'Title is required' };
    data.title = title;
  }
  if (body.description !== undefined) data.description = String(body.description ?? '').trim();
  if (body.videoLink !== undefined || !partial) {
    const link = String(body.videoLink ?? '').trim();
    if (!YOUTUBE_RE.test(link)) return { error: 'Enter a YouTube video link' };
    data.videoLink = link;
  }
  if (body.isActive !== undefined) data.isActive = body.isActive === true || body.isActive === 'true';
  if (body.sortOrder !== undefined && body.sortOrder !== null && body.sortOrder !== '') {
    const n = Number(body.sortOrder);
    if (!Number.isFinite(n)) return { error: 'Sort order must be a number' };
    data.sortOrder = n;
  }
  return { data };
};

/** GET /api/sara-videos (admin): every Sara's guide video, active or not. */
exports.list = async (req, res) => {
  try {
    res.json(await SaraVideo.find().sort(ORDER).lean());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** POST /api/sara-videos (admin) { title, description?, videoLink, isActive?, sortOrder? } */
exports.create = async (req, res) => {
  try {
    const { data, error } = readFields(req.body || {}, { partial: false });
    if (error) return res.status(400).json({ message: error });
    res.status(201).json(await SaraVideo.create(data));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** PUT /api/sara-videos/:id (admin): any of the create fields. */
exports.update = async (req, res) => {
  try {
    const { data, error } = readFields(req.body || {}, { partial: true });
    if (error) return res.status(400).json({ message: error });
    const video = await SaraVideo.findByIdAndUpdate(req.params.id, { $set: data }, { returnDocument: 'after', runValidators: true });
    if (!video) return res.status(404).json({ message: 'Video not found' });
    res.json(video);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** DELETE /api/sara-videos/:id (admin) */
exports.remove = async (req, res) => {
  try {
    const video = await SaraVideo.findByIdAndDelete(req.params.id);
    if (!video) return res.status(404).json({ message: 'Video not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/public/guide-videos (no sign-in): the mobile app's Sara's guide, signed in or out.
 * Active videos in playlist order; only title, description and video link.
 */
exports.listPublic = async (req, res) => {
  try {
    res.json(await SaraVideo.find({ isActive: true }).sort(ORDER).select('title description videoLink').lean());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
