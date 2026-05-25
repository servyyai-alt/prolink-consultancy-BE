const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const { protect, authorize, optionalAuth } = require('../middlewares/auth');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeSocialLinks = (input = {}) => ({
  facebook: input.facebook?.trim() || undefined,
  instagram: input.instagram?.trim() || undefined,
  linkedin: input.linkedin?.trim() || undefined,
  twitter: input.twitter?.trim() || undefined,
  youtube: input.youtube?.trim() || undefined,
});

const buildBlogPayload = (body = {}) => ({
  title: body.title?.trim(),
  category: body.category?.trim(),
  excerpt: body.excerpt?.trim(),
  content: body.content,
  tags: Array.isArray(body.tags) ? body.tags.map((tag) => `${tag}`.trim()).filter(Boolean) : [],
  status: body.status,
  thumbnail: body.thumbnail?.url ? { url: body.thumbnail.url, public_id: body.thumbnail.public_id } : undefined,
  socialLinks: normalizeSocialLinks(body.socialLinks),
  relatedPosts: Array.isArray(body.relatedPosts) ? body.relatedPosts.filter(Boolean) : [],
  metaTitle: body.metaTitle?.trim() || undefined,
  metaDescription: body.metaDescription?.trim() || undefined,
  isFeatured: typeof body.isFeatured === 'boolean' ? body.isFeatured : undefined,
});

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 9, category, search } = req.query;
    const query = { status: 'published' };
    if (category) query.category = category;
    if (search) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { title: regex },
        { excerpt: regex },
        { category: regex },
        { content: regex },
        { tags: { $in: [regex] } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [blogs, total] = await Promise.all([
      Blog.find(query)
        .populate('author', 'firstName lastName avatar')
        .sort('-publishedAt -createdAt')
        .skip(skip)
        .limit(parseInt(limit))
        .select('-content'),
      Blog.countDocuments(query),
    ]);
    sendPaginated(res, blogs, total, page, limit);
  } catch (e) { next(e); }
});

router.get('/:slug', optionalAuth, async (req, res, next) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug, status: 'published' })
      .populate('author', 'firstName lastName avatar profile.headline')
      .populate({
        path: 'relatedPosts',
        match: { status: 'published' },
        select: 'title slug excerpt thumbnail category publishedAt readTime',
        options: { sort: { publishedAt: -1, createdAt: -1 } },
      });
    if (!blog) return sendError(res, 404, 'Blog not found.');
    await Blog.findByIdAndUpdate(blog._id, { $inc: { views: 1 } });
    sendSuccess(res, 200, 'Blog fetched.', { data: { blog } });
  } catch (e) { next(e); }
});

router.post('/', protect, authorize('admin', 'super_admin', 'recruiter'), async (req, res, next) => {
  try {
    const blog = await Blog.create({ ...buildBlogPayload(req.body), author: req.user._id });
    sendSuccess(res, 201, 'Blog created.', { data: { blog } });
  } catch (e) { next(e); }
});

router.put('/:id', protect, authorize('admin', 'super_admin', 'recruiter'), async (req, res, next) => {
  try {
    const blog = await Blog.findByIdAndUpdate(req.params.id, buildBlogPayload(req.body), { new: true, runValidators: true });
    if (!blog) return sendError(res, 404, 'Blog not found.');
    sendSuccess(res, 200, 'Blog updated.', { data: { blog } });
  } catch (e) { next(e); }
});

router.delete('/:id', protect, authorize('admin', 'super_admin', 'recruiter'), async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return sendError(res, 404, 'Blog not found.');

    await Promise.all([
      Blog.updateMany({ relatedPosts: blog._id }, { $pull: { relatedPosts: blog._id } }),
      Blog.findByIdAndDelete(blog._id),
    ]);

    sendSuccess(res, 200, 'Blog deleted.');
  } catch (e) { next(e); }
});

module.exports = router;
