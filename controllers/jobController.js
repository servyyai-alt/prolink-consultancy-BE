const Job = require('../models/Job');
const Application = require('../models/Application');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');

const ALLOWED_JOB_TYPES = ['full_time', 'part_time', 'contract', 'internship', 'freelance'];
const ALLOWED_LOCATION_TYPES = ['onsite', 'remote', 'hybrid'];
const ALLOWED_JOB_STATUSES = ['draft', 'active', 'paused', 'closed', 'expired'];
const URL_REGEX = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/.*)?$/i;

const cleanString = (value) => (typeof value === 'string' ? value.trim() : '');
const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeSkills = (skills = []) => {
  if (!Array.isArray(skills)) return [];

  return [...new Set(
    skills
      .map((skill) => cleanString(skill))
      .filter(Boolean)
      .map((skill) => skill.toLowerCase())
  )].slice(0, 15);
};

const validateJobPayload = (body = {}, user) => {
  const title = cleanString(body.title);
  const description = cleanString(body.description);
  const requirements = cleanString(body.requirements);
  const responsibilities = cleanString(body.responsibilities);
  const category = cleanString(body.category);
  const type = cleanString(body.type) || 'full_time';
  const locationType = cleanString(body.locationType) || 'onsite';
  const location = cleanString(body.location);
  const education = cleanString(body.education);
  const deadline = body.deadline ? new Date(body.deadline) : null;
  const openings = toNumber(body.openings);
  const minExperience = toNumber(body.experience?.min);
  const maxExperience = toNumber(body.experience?.max);
  const minSalary = toNumber(body.salary?.min);
  const maxSalary = toNumber(body.salary?.max);
  const skills = normalizeSkills(body.skills);
  const companyName = cleanString(body.company?.name);
  const companyWebsite = cleanString(body.company?.website);
  const companyDescription = cleanString(body.company?.description);
  const status = cleanString(body.status) || 'active';

  const errors = {};

  if (!title || title.length < 5 || title.length > 100) errors.title = 'Job title must be between 5 and 100 characters.';
  if (!description || description.length < 50) errors.description = 'Job description must be at least 50 characters.';
  if (!requirements || requirements.length < 20) errors.requirements = 'Requirements must be at least 20 characters.';
  if (!responsibilities || responsibilities.length < 20) errors.responsibilities = 'Responsibilities must be at least 20 characters.';
  if (!category) errors.category = 'Category is required.';
  if (!ALLOWED_JOB_TYPES.includes(type)) errors.type = 'Select a valid job type.';
  if (!ALLOWED_LOCATION_TYPES.includes(locationType)) errors.locationType = 'Select a valid work mode.';
  if (!location || location.length < 2) errors.location = 'Location is required.';
  if (openings === null || openings < 1 || openings > 1000) errors.openings = 'Openings must be between 1 and 1000.';
  if (!education || education.length < 2) errors.education = 'Education is required.';
  if (minExperience === null || minExperience < 0) errors.experienceMin = 'Minimum experience must be 0 or more.';
  if (maxExperience === null || maxExperience < minExperience) errors.experienceMax = 'Maximum experience must be greater than or equal to minimum experience.';
  if (minSalary === null || minSalary < 10000) errors.salaryMin = 'Minimum salary must be a valid annual amount.';
  if (maxSalary === null || maxSalary < minSalary) errors.salaryMax = 'Maximum salary must be greater than or equal to minimum salary.';
  if (skills.length === 0) errors.skills = 'Add at least one skill.';
  if (skills.some((skill) => skill.length < 2)) errors.skills = 'Each skill must be at least 2 characters.';
  if (!ALLOWED_JOB_STATUSES.includes(status)) errors.status = 'Invalid job status.';

  if (deadline && Number.isNaN(deadline.getTime())) {
    errors.deadline = 'Enter a valid application deadline.';
  } else if (deadline) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (deadline < today) errors.deadline = 'Deadline must be today or later.';
  }

  const company = user.role === 'employer'
    ? {
        name: cleanString(user.company?.name) || companyName,
        logo: user.company?.logo?.url || undefined,
        website: cleanString(user.company?.website) || companyWebsite || undefined,
        description: cleanString(user.company?.description) || companyDescription,
      }
    : {
        name: companyName,
        website: companyWebsite || undefined,
        description: companyDescription,
      };

  if (!company.name || company.name.length < 2) errors.companyName = 'Company name is required.';
  if (company.website && !URL_REGEX.test(company.website)) errors.companyWebsite = 'Enter a valid company website URL.';
  if (!company.description || company.description.length < 20) errors.companyDescription = 'Company description must be at least 20 characters.';

  return {
    errors,
    data: {
      title,
      description,
      requirements,
      responsibilities,
      category,
      type,
      locationType,
      location,
      education,
      openings,
      deadline: deadline || undefined,
      featured: Boolean(body.featured),
      urgent: Boolean(body.urgent),
      status,
      skills,
      experience: {
        min: minExperience,
        max: maxExperience,
      },
      salary: {
        min: minSalary,
        max: maxSalary,
        currency: 'INR',
        period: body.salary?.period || 'yearly',
        isVisible: body.salary?.isVisible !== false,
      },
      company,
    },
  };
};

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
    const { errors, data } = validateJobPayload(req.body, req.user);

    if (Object.keys(errors).length > 0) {
      return sendError(res, 400, 'Please review the job details and try again.', errors);
    }

    const jobData = {
      ...data,
      postedBy: req.user._id,
    };

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
