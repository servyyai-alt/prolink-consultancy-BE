const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const { protect, authorize, optionalAuth } = require('../middlewares/auth');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 9, category, search } = req.query;
    const query = { status: 'published' };
    if (category) query.category = category;
    if (search) query.$text = { $search: search };
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [blogs, total] = await Promise.all([
      Blog.find(query).populate('author', 'firstName lastName avatar').sort('-publishedAt').skip(skip).limit(parseInt(limit)).select('-content'),
      Blog.countDocuments(query),
    ]);
    sendPaginated(res, blogs, total, page, limit);
  } catch (e) { next(e); }
});

router.get('/:slug', optionalAuth, async (req, res, next) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug, status: 'published' }).populate('author', 'firstName lastName avatar profile.headline');
    if (!blog) return sendError(res, 404, 'Blog not found.');
    await Blog.findByIdAndUpdate(blog._id, { $inc: { views: 1 } });
    sendSuccess(res, 200, 'Blog fetched.', { data: { blog } });
  } catch (e) { next(e); }
});

router.post('/', protect, authorize('admin', 'super_admin', 'recruiter'), async (req, res, next) => {
  try {
    const blog = await Blog.create({ ...req.body, author: req.user._id });
    sendSuccess(res, 201, 'Blog created.', { data: { blog } });
  } catch (e) { next(e); }
});

router.put('/:id', protect, authorize('admin', 'super_admin', 'recruiter'), async (req, res, next) => {
  try {
    const blog = await Blog.findByIdAndUpdate(req.params.id, req.body, { new: true });
    sendSuccess(res, 200, 'Blog updated.', { data: { blog } });
  } catch (e) { next(e); }
});

module.exports = router;