const Job = require('../models/Job');
const Application = require('../models/Application');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

// @GET /api/v1/jobs  - Public, with filters
exports.getJobs = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 12, search, category, type, locationType,
      minExp, maxExp, minSalary, maxSalary, skills, location, featured, sort = '-createdAt',
    } = req.query;

    const query = { status: 'active', isDeleted: false };

    if (search) query.$text = { $search: search };
    if (category) query.category = category;
    if (type) query.type = type;
    if (locationType) query.locationType = locationType;
    if (location) query.location = new RegExp(location, 'i');
    if (featured === 'true') query.featured = true;
    if (minExp !== undefined) query['experience.min'] = { $gte: parseInt(minExp) };
    if (maxExp !== undefined) query['experience.max'] = { $lte: parseInt(maxExp) };
    if (minSalary) query['salary.min'] = { $gte: parseInt(minSalary) };
    if (maxSalary) query['salary.max'] = { $lte: parseInt(maxSalary) };
    if (skills) {
      const skillArr = Array.isArray(skills) ? skills : skills.split(',');
      query.skills = { $in: skillArr };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [jobs, total] = await Promise.all([
      Job.find(query).sort(sort).skip(skip).limit(parseInt(limit)).populate('postedBy', 'firstName lastName company'),
      Job.countDocuments(query),
    ]);

    sendPaginated(res, jobs, total, page, limit, 'Jobs fetched successfully.');
  } catch (error) {
    next(error);
  }
};

// @GET /api/v1/jobs/:slug
exports.getJobBySlug = async (req, res, next) => {
  try {
    const job = await Job.findOne({ slug: req.params.slug, isDeleted: false })
      .populate('postedBy', 'firstName lastName company avatar');
    if (!job) return sendError(res, 404, 'Job not found.');

    // Increment views
    await Job.findByIdAndUpdate(job._id, { $inc: { views: 1 } });

    // Similar jobs
    const similar = await Job.find({
      _id: { $ne: job._id },
      category: job.category,
      status: 'active',
      isDeleted: false,
    }).limit(4).select('title company location type salary experience slug');

    sendSuccess(res, 200, 'Job fetched.', { data: { job, similarJobs: similar } });
  } catch (error) {
    next(error);
  }
};

// @POST /api/v1/jobs  - Employer/Admin
exports.createJob = async (req, res, next) => {
  try {
    const jobData = { ...req.body, postedBy: req.user._id };
    if (req.user.role === 'employer') {
      jobData.company = {
        name: req.user.company?.name || req.body.company?.name,
        logo: req.user.company?.logo?.url,
        website: req.user.company?.website,
        description: req.user.company?.description,
      };
    }
    const job = await Job.create(jobData);
    sendSuccess(res, 201, 'Job posted successfully.', { data: { job } });
  } catch (error) {
    next(error);
  }
};

// @PUT /api/v1/jobs/:id
exports.updateJob = async (req, res, next) => {
  try {
    let job = await Job.findById(req.params.id);
    if (!job) return sendError(res, 404, 'Job not found.');

    const isOwner = job.postedBy.toString() === req.user._id.toString();
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    if (!isOwner && !isAdmin) return sendError(res, 403, 'Not authorized.');

    job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    sendSuccess(res, 200, 'Job updated.', { data: { job } });
  } catch (error) {
    next(error);
  }
};

// @DELETE /api/v1/jobs/:id
exports.deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return sendError(res, 404, 'Job not found.');

    const isOwner = job.postedBy.toString() === req.user._id.toString();
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
    if (!isOwner && !isAdmin) return sendError(res, 403, 'Not authorized.');

    await Job.findByIdAndUpdate(req.params.id, { isDeleted: true, deletedAt: new Date(), status: 'closed' });
    sendSuccess(res, 200, 'Job deleted.');
  } catch (error) {
    next(error);
  }
};

// @GET /api/v1/jobs/categories
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Job.aggregate([
      { $match: { status: 'active', isDeleted: false } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    sendSuccess(res, 200, 'Categories fetched.', { data: { categories } });
  } catch (error) {
    next(error);
  }
};

// @GET /api/v1/jobs/employer/my-jobs
exports.getMyJobs = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { postedBy: req.user._id, isDeleted: false };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [jobs, total] = await Promise.all([
      Job.find(query).sort('-createdAt').skip(skip).limit(parseInt(limit)),
      Job.countDocuments(query),
    ]);
    sendPaginated(res, jobs, total, page, limit);
  } catch (error) {
    next(error);
  }
};
