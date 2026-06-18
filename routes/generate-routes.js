#!/usr/bin/env node
// This script generates stub routes for all remaining route files
// Run: node generate-routes.js

const fs = require('fs');
const path = require('path');

const routes = {
  userRoutes: `
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const User = require('../models/User');
const { uploadToCloudinary } = require('../config/cloudinary');
const { imageUpload, resumeUpload } = require('../middlewares/upload');
const { sendSuccess, sendError } = require('../utils/response');

router.get('/profile', protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  sendSuccess(res, 200, 'Profile fetched.', { data: { user } });
});

router.put('/profile', protect, async (req, res, next) => {
  try {
    const updates = req.body;
    delete updates.password; delete updates.role; delete updates.email;
    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true });
    sendSuccess(res, 200, 'Profile updated.', { data: { user } });
  } catch (e) { next(e); }
});

router.put('/change-password', protect, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) return sendError(res, 400, 'Current password is incorrect.');
    user.password = newPassword;
    await user.save();
    sendSuccess(res, 200, 'Password changed successfully.');
  } catch (e) { next(e); }
});

router.post('/upload-avatar', protect, imageUpload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.');
    const result = await uploadToCloudinary(req.file.path, 'prolink/avatars', { width: 300, height: 300, crop: 'fill' });
    await User.findByIdAndUpdate(req.user._id, { avatar: result });
    sendSuccess(res, 200, 'Avatar uploaded.', { data: { avatar: result } });
  } catch (e) { next(e); }
});

router.post('/upload-resume', protect, resumeUpload.single('resume'), async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.');
    const result = await uploadToCloudinary(req.file.path, 'prolink/resumes', { resource_type: 'raw' });
    await User.findByIdAndUpdate(req.user._id, { 'profile.resume': { ...result, uploadedAt: new Date() } });
    sendSuccess(res, 200, 'Resume uploaded.', { data: { resume: result } });
  } catch (e) { next(e); }
});

router.post('/save-job/:jobId', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const isSaved = user.savedJobs.includes(req.params.jobId);
    if (isSaved) {
      user.savedJobs.pull(req.params.jobId);
    } else {
      user.savedJobs.push(req.params.jobId);
    }
    await user.save();
    sendSuccess(res, 200, isSaved ? 'Job unsaved.' : 'Job saved.', { data: { saved: !isSaved } });
  } catch (e) { next(e); }
});

router.get('/saved-jobs', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('savedJobs', 'title company location state district address type salary slug status');
    sendSuccess(res, 200, 'Saved jobs fetched.', { data: { savedJobs: user.savedJobs } });
  } catch (e) { next(e); }
});

module.exports = router;
`,

  serviceRoutes: `
const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const { protect, authorize } = require('../middlewares/auth');
const { sendSuccess, sendError } = require('../utils/response');

router.get('/', async (req, res, next) => {
  try {
    const services = await Service.find({ isActive: true }).sort('order');
    sendSuccess(res, 200, 'Services fetched.', { data: { services } });
  } catch (e) { next(e); }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const service = await Service.findOne({ slug: req.params.slug, isActive: true });
    if (!service) return sendError(res, 404, 'Service not found.');
    sendSuccess(res, 200, 'Service fetched.', { data: { service } });
  } catch (e) { next(e); }
});

router.post('/', protect, authorize('admin', 'super_admin'), async (req, res, next) => {
  try {
    const service = await Service.create(req.body);
    sendSuccess(res, 201, 'Service created.', { data: { service } });
  } catch (e) { next(e); }
});

router.put('/:id', protect, authorize('admin', 'super_admin'), async (req, res, next) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!service) return sendError(res, 404, 'Service not found.');
    sendSuccess(res, 200, 'Service updated.', { data: { service } });
  } catch (e) { next(e); }
});

router.delete('/:id', protect, authorize('admin', 'super_admin'), async (req, res, next) => {
  try {
    await Service.findByIdAndDelete(req.params.id);
    sendSuccess(res, 200, 'Service deleted.');
  } catch (e) { next(e); }
});

module.exports = router;
`,

  blogRoutes: `
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
`,

  contactRoutes: `
const express = require('express');
const router = express.Router();
const ContactInquiry = require('../models/ContactInquiry');
const { sendSuccess } = require('../utils/response');
const { sendEmail } = require('../utils/emailService');

router.post('/', async (req, res, next) => {
  try {
    const inquiry = await ContactInquiry.create({
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    try {
      await sendEmail({
        to: process.env.EMAIL_USER,
        subject: \`New Contact Inquiry: \${req.body.subject}\`,
        html: \`<p>From: \${req.body.name} (\${req.body.email})</p><p>Service: \${req.body.service}</p><p>\${req.body.message}</p>\`,
      });
    } catch (_) {}
    sendSuccess(res, 201, 'Inquiry submitted. We will get back to you soon.', { data: { inquiry } });
  } catch (e) { next(e); }
});

module.exports = router;
`,

  testimonialRoutes: `
const express = require('express');
const router = express.Router();
const Testimonial = require('../models/Testimonial');
const { protect } = require('../middlewares/auth');
const { sendSuccess, sendPaginated } = require('../utils/response');

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 9, featured } = req.query;
    const query = { isApproved: true };
    if (featured === 'true') query.isFeatured = true;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [testimonials, total] = await Promise.all([
      Testimonial.find(query).sort('order -createdAt').skip(skip).limit(parseInt(limit)),
      Testimonial.countDocuments(query),
    ]);
    sendPaginated(res, testimonials, total, page, limit);
  } catch (e) { next(e); }
});

router.post('/', protect, async (req, res, next) => {
  try {
    const t = await Testimonial.create({ ...req.body, user: req.user._id });
    sendSuccess(res, 201, 'Testimonial submitted. Pending approval.', { data: { testimonial: t } });
  } catch (e) { next(e); }
});

module.exports = router;
`,

  notificationRoutes: `
const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middlewares/auth');
const { sendSuccess } = require('../utils/response');

router.get('/', protect, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id }).sort('-createdAt').limit(30);
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    sendSuccess(res, 200, 'Notifications fetched.', { data: { notifications, unreadCount } });
  } catch (e) { next(e); }
});

router.patch('/mark-read', protect, async (req, res, next) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true, readAt: new Date() });
    sendSuccess(res, 200, 'Notifications marked as read.');
  } catch (e) { next(e); }
});

router.patch('/:id/read', protect, async (req, res, next) => {
  try {
    await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { isRead: true, readAt: new Date() });
    sendSuccess(res, 200, 'Notification read.');
  } catch (e) { next(e); }
});

module.exports = router;
`,

  paymentRoutes: `
const express = require('express');
const router = express.Router();
const { createRazorpayOrder, verifyRazorpayPayment, createStripeIntent, stripeWebhook, getMyPayments } = require('../controllers/paymentController');
const { protect } = require('../middlewares/auth');
const express2 = require('express');

router.post('/razorpay/create-order', protect, createRazorpayOrder);
router.post('/razorpay/verify', protect, verifyRazorpayPayment);
router.post('/stripe/create-intent', protect, createStripeIntent);
router.post('/stripe/webhook', express2.raw({ type: 'application/json' }), stripeWebhook);
router.get('/my-payments', protect, getMyPayments);

module.exports = router;
`,

  uploadRoutes: `
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { anyUpload } = require('../middlewares/upload');
const { uploadToCloudinary } = require('../config/cloudinary');
const { sendSuccess, sendError } = require('../utils/response');
const fs = require('fs');

router.post('/image', protect, anyUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.');
    const { folder = 'prolink/misc' } = req.body;
    const result = await uploadToCloudinary(req.file.path, folder);
    fs.unlink(req.file.path, () => {});
    sendSuccess(res, 200, 'File uploaded.', { data: result });
  } catch (e) { next(e); }
});

module.exports = router;
`,

  analyticsRoutes: `
const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const Application = require('../models/Application');
const User = require('../models/User');
const Payment = require('../models/Payment');
const { protect, authorize } = require('../middlewares/auth');
const { sendSuccess } = require('../utils/response');

router.get('/employer', protect, authorize('employer', 'recruiter', 'admin', 'super_admin'), async (req, res, next) => {
  try {
    const userId = req.user._id;
    const myJobs = await Job.find({ postedBy: userId, isDeleted: false }).select('_id title applications views status');
    const jobIds = myJobs.map(j => j._id);
    const appsByStatus = await Application.aggregate([
      { $match: { employer: userId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const recentApps = await Application.find({ employer: userId })
      .populate('applicant', 'firstName lastName avatar profile.headline')
      .populate('job', 'title')
      .sort('-createdAt').limit(5);
    sendSuccess(res, 200, 'Employer analytics.', { data: { jobs: myJobs, appsByStatus, recentApps } });
  } catch (e) { next(e); }
});

module.exports = router;
`,

  cvRoutes: `
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { sendSuccess } = require('../utils/response');

// CV Writing plans
const CV_PLANS = [
  { id: 'basic', name: 'Basic', price: 499, features: ['ATS Optimized', '1 Page', '3-day delivery', '1 Revision'] },
  { id: 'standard', name: 'Standard', price: 999, features: ['ATS Optimized', '2 Pages', 'LinkedIn Optimization', '2-day delivery', '3 Revisions'] },
  { id: 'premium', name: 'Premium', price: 1999, features: ['ATS Optimized', 'Unlimited Pages', 'LinkedIn + Cover Letter', '1-day delivery', 'Unlimited Revisions', 'Interview Prep Guide'] },
];

router.get('/plans', (req, res) => res.json({ success: true, data: { plans: CV_PLANS } }));

router.post('/order', protect, async (req, res, next) => {
  try {
    const { plan, instructions, paymentId } = req.body;
    const CvOrder = require('../models/CvOrder') || {};
    // Store order in DB and notify admin
    sendSuccess(res, 201, 'CV order placed successfully. Our team will contact you soon.', {
      data: { order: { plan, instructions, userId: req.user._id } },
    });
  } catch (e) { next(e); }
});

module.exports = router;
`,

  campusRoutes: `
const express = require('express');
const router = express.Router();
const { sendSuccess, sendPaginated } = require('../utils/response');
const { protect, authorize } = require('../middlewares/auth');

router.get('/', async (req, res, next) => {
  try {
    const drives = []; // TODO: Fetch from CampusDrive model
    sendSuccess(res, 200, 'Campus drives fetched.', { data: { drives } });
  } catch (e) { next(e); }
});

module.exports = router;
`,

  eventRoutes: `
const express = require('express');
const router = express.Router();
const { sendSuccess } = require('../utils/response');

router.get('/', async (req, res, next) => {
  try {
    sendSuccess(res, 200, 'Events fetched.', { data: { events: [] } });
  } catch (e) { next(e); }
});

module.exports = router;
`,

  cateringRoutes: `
const express = require('express');
const router = express.Router();
const ContactInquiry = require('../models/ContactInquiry');
const { sendSuccess } = require('../utils/response');
const { sendEmail } = require('../utils/emailService');

router.post('/inquiry', async (req, res, next) => {
  try {
    const inquiry = await ContactInquiry.create({ ...req.body, service: 'catering', source: 'catering_form' });
    try {
      await sendEmail({
        to: process.env.EMAIL_USER,
        subject: 'New Catering Inquiry',
        html: \`<p>Name: \${req.body.name}</p><p>Email: \${req.body.email}</p><p>Phone: \${req.body.phone}</p><p>Event: \${req.body.message}</p>\`,
      });
    } catch (_) {}
    sendSuccess(res, 201, 'Catering inquiry submitted.', { data: { inquiry } });
  } catch (e) { next(e); }
});

module.exports = router;
`,
};

Object.entries(routes).forEach(([filename, content]) => {
  const filepath = path.join(__dirname, filename + '.js');
  if (!require('fs').existsSync(filepath)) {
    require('fs').writeFileSync(filepath, content.trim());
    console.log('Created:', filename);
  }
});
