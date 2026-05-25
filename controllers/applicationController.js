const Application = require('../models/Application');
const Job = require('../models/Job');
const Notification = require('../models/Notification');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { sendInBackground, sendTemplateEmail } = require('../utils/emailService');

// @POST /api/v1/applications  - Job Seeker
exports.applyForJob = async (req, res, next) => {
  try {
    const { jobId, coverLetter } = req.body;

    const job = await Job.findById(jobId).populate('postedBy');
    if (!job || job.status !== 'active') return sendError(res, 404, 'Job not available.');

    const existing = await Application.findOne({ job: jobId, applicant: req.user._id });
    if (existing) return sendError(res, 409, 'Already applied for this job.');

    const resume = req.user.profile?.resume;
    if (!resume?.url) return sendError(res, 400, 'Please upload a resume before applying.');

    const application = await Application.create({
      job: jobId,
      applicant: req.user._id,
      employer: job.postedBy._id,
      resume,
      coverLetter,
    });

    await Job.findByIdAndUpdate(jobId, { $inc: { applications: 1 } });

    // Notify employer
    await Notification.create({
      recipient: job.postedBy._id,
      sender: req.user._id,
      type: 'job_application',
      title: 'New Application Received',
      message: `${req.user.fullName} applied for ${job.title}`,
      link: `/dashboard/applications/${application._id}`,
    });

    sendSuccess(res, 201, 'Application submitted successfully.', { data: { application } });

    sendInBackground(
      () => sendTemplateEmail(req.user.email, 'applicationReceived', req.user.firstName, job.title),
      'Application confirmation email'
    );
  } catch (error) {
    next(error);
  }
};

// @GET /api/v1/applications/my-applications  - Job Seeker
exports.getMyApplications = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { applicant: req.user._id };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [applications, total] = await Promise.all([
      Application.find(query)
        .populate('job', 'title company location type salary slug status')
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

// @GET /api/v1/applications/job/:jobId  - Employer/Recruiter
exports.getJobApplications = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const job = await Job.findById(req.params.jobId);
    if (!job) return sendError(res, 404, 'Job not found.');

    const isOwner = job.postedBy.toString() === req.user._id.toString();
    const isAdmin = ['admin', 'super_admin', 'recruiter'].includes(req.user.role);
    if (!isOwner && !isAdmin) return sendError(res, 403, 'Not authorized.');

    const query = { job: req.params.jobId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [applications, total] = await Promise.all([
      Application.find(query)
        .populate('applicant', 'firstName lastName email phone avatar profile.headline profile.skills profile.resume profile.atsScore')
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

// @PUT /api/v1/applications/:id/status  - Employer/Recruiter
exports.updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const application = await Application.findById(req.params.id).populate('job applicant');
    if (!application) return sendError(res, 404, 'Application not found.');

    const isOwner = application.employer.toString() === req.user._id.toString();
    const isAdmin = ['admin', 'super_admin', 'recruiter'].includes(req.user.role);
    if (!isOwner && !isAdmin) return sendError(res, 403, 'Not authorized.');

    application.statusHistory.push({ status: application.status, changedBy: req.user._id, note });
    application.status = status;
    await application.save();

    // Notify applicant
    await Notification.create({
      recipient: application.applicant._id,
      sender: req.user._id,
      type: 'application_status',
      title: 'Application Status Updated',
      message: `Your application for ${application.job.title} is now ${status.replace(/_/g, ' ')}.`,
      link: `/dashboard/applications`,
    });

    sendSuccess(res, 200, 'Application status updated.', { data: { application } });
  } catch (error) {
    next(error);
  }
};

// @PUT /api/v1/applications/:id/withdraw  - Job Seeker
exports.withdrawApplication = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const application = await Application.findOne({ _id: req.params.id, applicant: req.user._id });
    if (!application) return sendError(res, 404, 'Application not found.');
    if (['hired', 'rejected'].includes(application.status)) {
      return sendError(res, 400, 'Cannot withdraw this application.');
    }
    application.status = 'withdrawn';
    application.withdrawnReason = reason;
    await application.save();
    sendSuccess(res, 200, 'Application withdrawn.');
  } catch (error) {
    next(error);
  }
};

// @PUT /api/v1/applications/:id/schedule-interview
exports.scheduleInterview = async (req, res, next) => {
  try {
    const { scheduledAt, type, link, location, notes } = req.body;
    const application = await Application.findById(req.params.id).populate('applicant job');
    if (!application) return sendError(res, 404, 'Application not found.');

    application.interview = { scheduledAt, type, link, location, notes };
    application.status = 'interview_scheduled';
    await application.save();

    // Notify applicant
    await Notification.create({
      recipient: application.applicant._id,
      type: 'interview_scheduled',
      title: 'Interview Scheduled',
      message: `Interview scheduled for ${application.job.title} on ${new Date(scheduledAt).toLocaleString()}`,
      link: '/dashboard/interviews',
    });

    sendSuccess(res, 200, 'Interview scheduled.', { data: { application } });
  } catch (error) {
    next(error);
  }
};
