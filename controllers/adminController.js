const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');
const Payment = require('../models/Payment');
const ContactInquiry = require('../models/ContactInquiry');
const Blog = require('../models/Blog');
const Service = require('../models/Service');
const Testimonial = require('../models/Testimonial');
const Notification = require('../models/Notification');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

const ADMIN_CREATABLE_ROLES = ['admin', 'recruiter', 'employer', 'job_seeker'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

const cleanString = (value) => (typeof value === 'string' ? value.trim() : '');

const buildUserPayload = (body = {}) => {
  const firstName = cleanString(body.firstName);
  const lastName = cleanString(body.lastName);
  const email = cleanString(body.email).toLowerCase();
  const phone = cleanString(body.phone);
  const password = body.password || '';
  const role = cleanString(body.role);
  const companyName = cleanString(body.companyName);
  const companyWebsite = cleanString(body.companyWebsite);
  const companyDescription = cleanString(body.companyDescription);
  const companyLocation = cleanString(body.companyLocation);

  const errors = {};

  if (!firstName || firstName.length < 2) errors.firstName = 'First name must be at least 2 characters.';
  if (!lastName || lastName.length < 2) errors.lastName = 'Last name must be at least 2 characters.';
  if (!email || !EMAIL_REGEX.test(email)) errors.email = 'Enter a valid email address.';
  if (phone && !INDIAN_MOBILE_REGEX.test(phone)) errors.phone = 'Enter a valid 10-digit Indian mobile number.';
  if (!password || password.length < 8) errors.password = 'Password must be at least 8 characters.';
  if (!ADMIN_CREATABLE_ROLES.includes(role)) errors.role = 'Select a valid role.';

  if (role === 'employer') {
    if (!companyName || companyName.length < 2) errors.companyName = 'Company name is required for employer users.';
    if (!companyDescription || companyDescription.length < 20) errors.companyDescription = 'Company description must be at least 20 characters.';
  }

  return {
    errors,
    data: {
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      password,
      role,
      company: role === 'employer'
        ? {
            name: companyName,
            website: companyWebsite || undefined,
            description: companyDescription,
            location: companyLocation || undefined,
          }
        : undefined,
    },
  };
};

// @GET /api/v1/admin/dashboard-stats
exports.getDashboardStats = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalUsers, newUsersThisMonth, newUsersLastMonth,
      totalJobs, activeJobs,
      totalApplications, applicationsThisMonth,
      totalPayments, revenueThisMonth, revenueLastMonth,
      newContacts,
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'super_admin' } }),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } }),
      Job.countDocuments({ isDeleted: false }),
      Job.countDocuments({ status: 'active', isDeleted: false }),
      Application.countDocuments(),
      Application.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Payment.countDocuments({ status: 'completed' }),
      Payment.aggregate([{ $match: { status: 'completed', createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Payment.aggregate([{ $match: { status: 'completed', createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      ContactInquiry.countDocuments({ status: 'new' }),
    ]);

    // Monthly user registrations (last 6 months)
    const userTrend = await User.aggregate([
      { $match: { createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Jobs by category
    const jobsByCategory = await Job.aggregate([
      { $match: { status: 'active', isDeleted: false } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]);

    // Applications by status
    const applicationsByStatus = await Application.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const thisRevenue = revenueThisMonth[0]?.total || 0;
    const lastRevenue = revenueLastMonth[0]?.total || 0;
    const revenueGrowth = lastRevenue ? (((thisRevenue - lastRevenue) / lastRevenue) * 100).toFixed(1) : 100;

    sendSuccess(res, 200, 'Dashboard stats fetched.', {
      data: {
        stats: {
          users: { total: totalUsers, thisMonth: newUsersThisMonth, growth: newUsersLastMonth ? (((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100).toFixed(1) : 100 },
          jobs: { total: totalJobs, active: activeJobs },
          applications: { total: totalApplications, thisMonth: applicationsThisMonth },
          revenue: { total: thisRevenue, growth: revenueGrowth },
          contacts: { unread: newContacts },
        },
        charts: { userTrend, jobsByCategory, applicationsByStatus },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @GET /api/v1/admin/users
exports.getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search, isActive, isBlocked } = req.query;
    const query = { role: { $ne: 'super_admin' } };
    if (role) query.role = role;
    if (search) query.$or = [
      { firstName: new RegExp(search, 'i') },
      { lastName: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
    ];
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (isBlocked !== undefined) query.isBlocked = isBlocked === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(query).sort('-createdAt').skip(skip).limit(parseInt(limit)),
      User.countDocuments(query),
    ]);
    sendPaginated(res, users, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @POST /api/v1/admin/users
exports.createUser = async (req, res, next) => {
  try {
    const { errors, data } = buildUserPayload(req.body);

    if (Object.keys(errors).length > 0) {
      return sendError(res, 400, 'Please correct the highlighted fields.', errors);
    }

    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      return sendError(res, 409, 'Email already registered.', { email: 'This email is already in use.' });
    }

    const user = await User.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      password: data.password,
      role: data.role,
      isVerified: true,
      createdBy: req.user._id,
      ...(data.company ? { company: data.company } : {}),
    });

    sendSuccess(res, 201, 'User created successfully.', {
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @PATCH /api/v1/admin/users/:id/block
exports.toggleBlockUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, 404, 'User not found.');
    if (user.role === 'super_admin') return sendError(res, 403, 'Cannot modify super admin.');

    user.isBlocked = !user.isBlocked;
    await user.save();
    sendSuccess(res, 200, `User ${user.isBlocked ? 'blocked' : 'unblocked'}.`);
  } catch (error) {
    next(error);
  }
};

// @PATCH /api/v1/admin/users/:id/role
exports.changeUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const allowedRoles = ['admin', 'recruiter', 'employer', 'job_seeker'];
    if (!allowedRoles.includes(role)) return sendError(res, 400, 'Invalid role.');

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return sendError(res, 404, 'User not found.');
    sendSuccess(res, 200, 'Role updated.', { data: { user } });
  } catch (error) {
    next(error);
  }
};

// @PATCH /api/v1/admin/users/:id/approve
exports.approveUser = async (req, res, next) => {
  try {
    const { approve } = req.body // { approve: true/false }
    const user = await User.findById(req.params.id)
    if (!user) return sendError(res, 404, 'User not found.')
    if (user.role === 'super_admin') return sendError(res, 403, 'Cannot modify super admin.')

    user.isApproved = approve === false ? false : true
    await user.save()
    sendSuccess(res, 200, `User ${user.isApproved ? 'approved' : 'unapproved'}.`, { data: { user } })
  } catch (error) {
    next(error)
  }
}

// @DELETE /api/v1/admin/users/:id
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return sendError(res, 404, 'User not found.');
    if (user.role === 'super_admin') return sendError(res, 403, 'Cannot delete super admin.');
    if (user._id.toString() === req.user._id.toString()) return sendError(res, 403, 'You cannot delete your own account.');

    await Promise.all([
      Job.updateMany(
        { postedBy: user._id, isDeleted: false },
        { $set: { isDeleted: true, deletedAt: new Date(), status: 'closed' } }
      ),
      Application.deleteMany({
        $or: [{ applicant: user._id }, { employer: user._id }],
      }),
      Payment.deleteMany({ user: user._id }),
      Blog.deleteMany({ author: user._id }),
      Testimonial.deleteMany({ user: user._id }),
      Notification.deleteMany({ user: user._id }),
      User.findByIdAndDelete(user._id),
    ]);

    sendSuccess(res, 200, 'User deleted successfully.');
  } catch (error) {
    next(error);
  }
};

// @GET /api/v1/admin/contacts
exports.getContacts = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const query = {};
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [contacts, total] = await Promise.all([
      ContactInquiry.find(query).sort('-createdAt').skip(skip).limit(parseInt(limit)),
      ContactInquiry.countDocuments(query),
    ]);
    sendPaginated(res, contacts, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @GET /api/v1/admin/payments
exports.getPayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [payments, total] = await Promise.all([
      Payment.find(query).populate('user', 'firstName lastName email').sort('-createdAt').skip(skip).limit(parseInt(limit)),
      Payment.countDocuments(query),
    ]);
    sendPaginated(res, payments, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @GET /api/v1/admin/applications
exports.getApplications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const query = {};

    if (status) query.status = status;

    if (search) {
      const users = await User.find({
        $or: [
          { firstName: new RegExp(search, 'i') },
          { lastName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') },
        ],
      }).select('_id');

      const jobs = await Job.find({
        $or: [
          { title: new RegExp(search, 'i') },
          { 'company.name': new RegExp(search, 'i') },
          { location: new RegExp(search, 'i') },
        ],
      }).select('_id');

      query.$or = [
        { applicant: { $in: users.map((user) => user._id) } },
        { employer: { $in: users.map((user) => user._id) } },
        { job: { $in: jobs.map((job) => job._id) } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [applications, total] = await Promise.all([
      Application.find(query)
        .populate('applicant', 'firstName lastName email avatar')
        .populate('employer', 'firstName lastName email')
        .populate('job', 'title slug location company type')
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit)),
      Application.countDocuments(query),
    ]);

    sendPaginated(res, applications, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @GET /api/v1/admin/blogs
exports.getBlogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, category, search } = req.query;
    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { excerpt: new RegExp(search, 'i') },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [blogs, total] = await Promise.all([
      Blog.find(query)
        .populate('author', 'firstName lastName email')
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit)),
      Blog.countDocuments(query),
    ]);

    sendPaginated(res, blogs, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @GET /api/v1/admin/services
exports.getServices = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { category: new RegExp(search, 'i') },
        { shortDescription: new RegExp(search, 'i') },
      ];
    }
    if (isActive !== undefined && isActive !== '') query.isActive = isActive === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [services, total] = await Promise.all([
      Service.find(query).sort('order createdAt').skip(skip).limit(parseInt(limit)),
      Service.countDocuments(query),
    ]);

    sendPaginated(res, services, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @GET /api/v1/admin/testimonials
exports.getTestimonials = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, approval, search } = req.query;
    const query = {};

    if (approval === 'approved') query.isApproved = true;
    if (approval === 'pending') query.isApproved = false;
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { designation: new RegExp(search, 'i') },
        { company: new RegExp(search, 'i') },
        { content: new RegExp(search, 'i') },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [testimonials, total] = await Promise.all([
      Testimonial.find(query)
        .populate('service', 'name slug')
        .populate('user', 'firstName lastName email')
        .sort('isApproved order -createdAt')
        .skip(skip)
        .limit(parseInt(limit)),
      Testimonial.countDocuments(query),
    ]);

    sendPaginated(res, testimonials, total, page, limit);
  } catch (error) {
    next(error);
  }
};

// @PATCH /api/v1/admin/testimonials/:id/approve
exports.approveTestimonial = async (req, res, next) => {
  try {
    const Testimonial = require('../models/Testimonial');
    const t = await Testimonial.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
    if (!t) return sendError(res, 404, 'Testimonial not found.');
    sendSuccess(res, 200, 'Testimonial approved.', { data: { testimonial: t } });
  } catch (error) {
    next(error);
  }
};

// @PATCH /api/v1/admin/testimonials/:id
exports.updateTestimonial = async (req, res, next) => {
  try {
    const allowed = ['name', 'designation', 'company', 'content', 'rating', 'isFeatured', 'order', 'isApproved'];
    const updates = {};

    Object.keys(req.body || {}).forEach((key) => {
      if (allowed.includes(key)) updates[key] = req.body[key];
    });

    const t = await Testimonial.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!t) return sendError(res, 404, 'Testimonial not found.');
    sendSuccess(res, 200, 'Testimonial updated.', { data: { testimonial: t } });
  } catch (error) {
    next(error);
  }
};

// @DELETE /api/v1/admin/testimonials/:id
exports.deleteTestimonial = async (req, res, next) => {
  try {
    const t = await Testimonial.findById(req.params.id);
    if (!t) return sendError(res, 404, 'Testimonial not found.');
    await Testimonial.findByIdAndDelete(req.params.id);
    sendSuccess(res, 200, 'Testimonial deleted.');
  } catch (error) {
    next(error);
  }
};
