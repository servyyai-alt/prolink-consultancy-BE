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

const normalizeTables = (input = []) => {
  if (!Array.isArray(input)) return [];

  return input.map((table) => {
    const headers = Array.isArray(table.headers)
      ? table.headers.map((header) => `${header}`.trim()).filter(Boolean)
      : [];
    const rows = Array.isArray(table.rows)
      ? table.rows
        .map((row) => Array.isArray(row) ? row.map((cell) => `${cell}`.trim()) : [])
        .filter((row) => row.some(Boolean))
      : [];

    return {
      title: table.title?.trim() || undefined,
      headers,
      rows,
    };
  }).filter((table) => table.headers.length > 0 && table.rows.length > 0);
};

const buildBlogPayload = (body = {}) => ({
  title: body.title?.trim(),
  category: body.category?.trim(),
  excerpt: body.excerpt?.trim(),
  content: body.content,
  tags: Array.isArray(body.tags) ? body.tags.map((tag) => `${tag}`.trim()).filter(Boolean) : [],
  status: body.status,
  thumbnail: body.thumbnail?.url ? { url: body.thumbnail.url, public_id: body.thumbnail.public_id } : undefined,
  socialLinks: normalizeSocialLinks(body.socialLinks),
  tables: normalizeTables(body.tables),
  relatedPosts: Array.isArray(body.relatedPosts) ? body.relatedPosts.filter(Boolean) : [],
  metaTitle: body.metaTitle?.trim() || undefined,
  metaDescription: body.metaDescription?.trim() || undefined,
  isFeatured: typeof body.isFeatured === 'boolean' ? body.isFeatured : undefined,
});

const normalizeCommentStatus = (comment = {}) => {
  if (comment.status) return comment.status;
  return comment.isApproved ? 'approved' : 'pending';
};

const getVisibleComments = (comments = [], viewerId) => comments.filter((comment) => {
  const status = normalizeCommentStatus(comment);
  const commentUserId = comment.user?._id?.toString?.() || comment.user?.toString?.();
  return status === 'approved' || (viewerId && commentUserId === viewerId);
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
      .populate('comments.user', 'firstName lastName avatar')
      .populate({
        path: 'relatedPosts',
        match: { status: 'published' },
        select: 'title slug excerpt thumbnail category publishedAt readTime',
        options: { sort: { publishedAt: -1, createdAt: -1 } },
      });
    if (!blog) return sendError(res, 404, 'Blog not found.');
    await Blog.findByIdAndUpdate(blog._id, { $inc: { views: 1 } });

    const viewerId = req.user?._id?.toString();
    const visibleComments = getVisibleComments(blog.comments || [], viewerId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const approvedCommentsCount = (blog.comments || []).filter((comment) => normalizeCommentStatus(comment) === 'approved').length;
    const blogData = blog.toObject();
    blogData.comments = visibleComments;
    blogData.approvedCommentsCount = approvedCommentsCount;
    blogData.totalCommentsCount = blog.comments?.length || 0;

    sendSuccess(res, 200, 'Blog fetched.', { data: { blog: blogData } });
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

router.post('/:id/comments', protect, async (req, res, next) => {
  try {
    const content = req.body.content?.trim();
    if (!content) return sendError(res, 400, 'Comment is required.', { content: 'Comment is required.' });
    if (content.length < 3) return sendError(res, 400, 'Comment must be at least 3 characters.', { content: 'Comment must be at least 3 characters.' });
    if (content.length > 1000) return sendError(res, 400, 'Comment must be 1000 characters or less.', { content: 'Comment must be 1000 characters or less.' });

    const blog = await Blog.findOne({ _id: req.params.id, status: 'published' });
    if (!blog) return sendError(res, 404, 'Blog not found.');

    blog.comments.push({
      user: req.user._id,
      name: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
      email: req.user.email,
      content,
      status: 'pending',
      isApproved: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await blog.save();

    const comment = blog.comments[blog.comments.length - 1];
    sendSuccess(res, 201, 'Comment submitted and pending admin approval.', {
      data: {
        comment,
      },
    });
  } catch (e) { next(e); }
});

router.patch('/:blogId/comments/:commentId', protect, authorize('admin', 'super_admin', 'recruiter'), async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return sendError(res, 400, 'Invalid comment status.', { status: 'Invalid comment status.' });
    }

    const blog = await Blog.findById(req.params.blogId);
    if (!blog) return sendError(res, 404, 'Blog not found.');

    const comment = blog.comments.id(req.params.commentId);
    if (!comment) return sendError(res, 404, 'Comment not found.');

    comment.status = status;
    comment.isApproved = status === 'approved';
    comment.updatedAt = new Date();

    await blog.save();

    sendSuccess(res, 200, 'Comment status updated.', { data: { comment } });
  } catch (e) { next(e); }
});

router.delete('/:blogId/comments/:commentId', protect, authorize('admin', 'super_admin', 'recruiter'), async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.blogId);
    if (!blog) return sendError(res, 404, 'Blog not found.');

    const comment = blog.comments.id(req.params.commentId);
    if (!comment) return sendError(res, 404, 'Comment not found.');

    comment.deleteOne();
    await blog.save();

    sendSuccess(res, 200, 'Comment deleted.');
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
