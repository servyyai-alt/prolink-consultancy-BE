const Job = require('../models/Job');
const Application = require('../models/Application');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { notifyAdmins } = require('../utils/notificationService');

const ALLOWED_JOB_TYPES = ['full_time', 'part_time', 'contract', 'internship', 'freelance'];
const ALLOWED_LOCATION_TYPES = ['onsite', 'remote', 'hybrid'];
const ALLOWED_JOB_STATUSES = ['draft', 'active', 'paused', 'closed', 'expired'];
const URL_REGEX = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/.*)?$/i;

const cleanString = (value) => (typeof value === 'string' ? value.trim() : '');
const buildLocation = ({ address, district, state }) => [address, district, state]
  .map((part) => cleanString(part))
  .filter((part, index, arr) => Boolean(part) && arr.indexOf(part) === index)
  .join(', ');
const splitLegacyLocation = (location = '') => {
  const parts = cleanString(location)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 3) {
    return {
      address: parts.slice(0, parts.length - 2).join(', '),
      district: parts[parts.length - 2] || '',
      state: parts[parts.length - 1] || '',
    };
  }

  if (parts.length === 2) {
    return { address: parts[0] || '', district: parts[0] || '', state: parts[1] || '' };
  }

  if (/^remote\b/i.test(parts[0] || '')) {
    return { address: '', district: '', state: '' };
  }

  return { address: '', district: '', state: parts[0] || '' };
};
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
  const legacyLocation = splitLegacyLocation(location);
  const state = cleanString(body.state) || legacyLocation.state;
  const district = cleanString(body.district) || legacyLocation.district;
  const address = cleanString(body.address) || legacyLocation.address;
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
  if (locationType !== 'remote') {
    if (!state || state.length < 2) errors.state = 'State is required.';
    if (!district || district.length < 2) errors.district = 'District is required.';
    if (!address || address.length < 5) errors.address = 'Address must be at least 5 characters.';
  }
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
      location: buildLocation({ address, district, state }) || location || (locationType === 'remote' ? 'Remote' : ''),
      state,
      district,
      address,
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
// exports.getJobs = async (req, res, next) => {
//   try {
//     const {
//       page = 1, limit = 12, search, category, type, locationType,
//       minExp, maxExp, minSalary, maxSalary, skills, location, featured, sort = '-createdAt',
//     } = req.query;

//     const query = { status: 'active', isDeleted: false };

//     if (search) query.$text = { $search: search };
//     if (category) query.category = category;
//     if (type) query.type = type;
//     if (locationType) query.locationType = locationType;
//     if (location) {
//       query.$or = [
//         { location: new RegExp(location, 'i') },
//         { state: new RegExp(location, 'i') },
//         { district: new RegExp(location, 'i') },
//         { address: new RegExp(location, 'i') },
//       ];
//     }
//     if (featured === 'true') query.featured = true;
//     if (minExp !== undefined) query['experience.min'] = { $gte: parseInt(minExp) };
//     if (maxExp !== undefined) query['experience.max'] = { $lte: parseInt(maxExp) };
//     if (minSalary) query['salary.min'] = { $gte: parseInt(minSalary) };
//     if (maxSalary) query['salary.max'] = { $lte: parseInt(maxSalary) };
//     if (skills) {
//       const skillArr = Array.isArray(skills) ? skills : skills.split(',');
//       query.skills = { $in: skillArr };
//     }

//     const skip = (parseInt(page) - 1) * parseInt(limit);
//     const [jobs, total] = await Promise.all([
//       Job.find(query).sort(sort).skip(skip).limit(parseInt(limit)).populate('postedBy', 'firstName lastName company'),
//       Job.countDocuments(query),
//     ]);

//     sendPaginated(res, jobs, total, page, limit, 'Jobs fetched successfully.');
//   } catch (error) {
//     next(error);
//   }
// };
exports.getJobs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      search,
      category,
      type,
      locationType,
      minExp,
      maxExp,
      minSalary,
      maxSalary,
      skills,
      location,
      featured,
      sort = '-createdAt',
    } = req.query;

    const query = {
      status: 'active',
      isDeleted: false,
    };

    // Global Search (Case Insensitive)
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
        { skills: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { state: { $regex: search, $options: 'i' } },
        { district: { $regex: search, $options: 'i' } },
      ];
    }

    if (category) query.category = category;
    if (type) query.type = type;
    if (locationType) query.locationType = locationType;

    // Location Search (Case Insensitive)
    if (location) {
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { location: { $regex: location, $options: 'i' } },
            { state: { $regex: location, $options: 'i' } },
            { district: { $regex: location, $options: 'i' } },
            { address: { $regex: location, $options: 'i' } },
          ],
        },
      ];
    }

    if (featured === 'true') query.featured = true;

    if (minExp !== undefined) {
      query['experience.min'] = { $gte: Number(minExp) };
    }

    if (maxExp !== undefined) {
      query['experience.max'] = { $lte: Number(maxExp) };
    }

    if (minSalary) {
      query['salary.min'] = { $gte: Number(minSalary) };
    }

    if (maxSalary) {
      query['salary.max'] = { $lte: Number(maxSalary) };
    }

    // Skills Search (Case Insensitive)
    if (skills) {
      const skillArr = Array.isArray(skills)
        ? skills
        : skills.split(',');

      query.skills = {
        $in: skillArr.map(
          skill => new RegExp(`^${skill.trim()}$`, 'i')
        ),
      };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [jobs, total] = await Promise.all([
      Job.find(query)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .populate(
          'postedBy',
          'firstName lastName company'
        ),
      Job.countDocuments(query),
    ]);

    sendPaginated(
      res,
      jobs,
      total,
      page,
      limit,
      'Jobs fetched successfully.'
    );
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
    }).limit(4).select('title company location state district address type salary experience slug');

    sendSuccess(res, 200, 'Job fetched.', { data: { job, similarJobs: similar } });
  } catch (error) {
    next(error);
  }
};

// @POST /api/v1/jobs  - Employer/Admin
exports.createJob = async (req, res, next) => {
  try {
    // Only allow posting if employer is approved by admin
    if (req.user.role === 'employer' && !req.user.isApproved) {
      return sendError(res, 403, 'Your account is not approved to post jobs. Please contact an administrator.')
    }
    const { errors, data } = validateJobPayload(req.body, req.user);

    if (Object.keys(errors).length > 0) {
      return sendError(res, 400, 'Please review the job details and try again.', errors);
    }

    const jobData = {
      ...data,
      location: buildLocation(data) || (data.locationType === 'remote' ? 'Remote' : ''),
      postedBy: req.user._id,
    };

    const job = await Job.create(jobData);

    if (req.user.role === 'employer') {
      await notifyAdmins(req, {
        sender: req.user._id,
        type: 'job_posted',
        title: 'New Job Posted',
        message: `${req.user.company?.name || req.user.fullName || 'An employer'} posted ${job.title}.`,
        link: '/admin/jobs',
        data: {
          jobId: job._id.toString(),
          status: job.status,
        },
      });
    }

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

    const { errors, data } = validateJobPayload(req.body, req.user);
    if (Object.keys(errors).length > 0) {
      return sendError(res, 400, 'Please review the job details and try again.', errors);
    }

    job = await Job.findByIdAndUpdate(
      req.params.id,
      { ...data, location: buildLocation(data) || (data.locationType === 'remote' ? 'Remote' : '') },
      { new: true, runValidators: true }
    );
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
