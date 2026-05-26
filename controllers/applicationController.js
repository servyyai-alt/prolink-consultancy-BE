const Application = require('../models/Application');
const Job = require('../models/Job');
const Notification = require('../models/Notification');
const { sendSuccess, sendError, sendPaginated } = require('../utils/response');
const { sendInBackground, sendTemplateEmail } = require('../utils/emailService');

const APPLICATION_FLOW = {
  applied: ['screening', 'rejected'],
  screening: ['shortlisted', 'rejected'],
  shortlisted: ['interview_scheduled', 'rejected'],
  interview_scheduled: ['offered', 'rejected'],
  interviewed: ['offered', 'rejected'],
  offered: ['hired', 'rejected'],
  hired: [],
  rejected: [],
  withdrawn: [],
};

const INTERVIEW_TYPES = ['phone', 'video', 'in_person', 'technical'];

const canManageApplication = (application, user) => {
  const isOwner = application.employer.toString() === user._id.toString();
  const isAdmin = ['admin', 'super_admin', 'recruiter'].includes(user.role);
  return isOwner || isAdmin;
};

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
      statusHistory: [
        {
          status: 'applied',
          changedBy: req.user._id,
          note: 'Application submitted successfully.',
        },
      ],
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
        .populate('statusHistory.changedBy', 'firstName lastName role')
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

    if (!canManageApplication(application, req.user)) return sendError(res, 403, 'Not authorized.');

    if (!APPLICATION_FLOW[application.status]) {
      return sendError(res, 400, 'Current application status is invalid.');
    }

    if (!APPLICATION_FLOW[application.status].includes(status)) {
      return sendError(res, 400, `Cannot move application from ${application.status.replace(/_/g, ' ')} to ${String(status || '').replace(/_/g, ' ')}.`);
    }

    if (status === 'interview_scheduled') {
      return sendError(res, 400, 'Please use schedule interview to set the interview date and time.');
    }

    application.status = status;
    application.statusHistory.push({ status, changedBy: req.user._id, note });
    await application.save();

    // Notify applicant
    const notification = await Notification.create({
      recipient: application.applicant._id,
      sender: req.user._id,
      type: 'application_status',
      title: 'Application Status Updated',
      message: `Your application for ${application.job.title} is now ${status.replace(/_/g, ' ')}.`,
      link: `/dashboard/applications`,
    });

    req.app.get('io')?.sendNotification?.(String(application.applicant._id), notification);

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
    application.statusHistory.push({
      status: 'withdrawn',
      changedBy: req.user._id,
      note: reason || 'Application withdrawn by candidate.',
    });
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

    if (!canManageApplication(application, req.user)) return sendError(res, 403, 'Not authorized.');
    if (application.status !== 'shortlisted') {
      return sendError(res, 400, 'Only shortlisted applications can be scheduled for interview.');
    }

    const interviewDate = scheduledAt ? new Date(scheduledAt) : null;
    if (!interviewDate || Number.isNaN(interviewDate.getTime())) {
      return sendError(res, 400, 'Interview date and time is required.');
    }
    if (interviewDate <= new Date()) {
      return sendError(res, 400, 'Interview date and time must be in the future.');
    }
    if (type && !INTERVIEW_TYPES.includes(type)) {
      return sendError(res, 400, 'Select a valid interview type.');
    }

    application.interview = { scheduledAt: interviewDate, type: type || 'video', link, location, notes };
    application.status = 'interview_scheduled';
    application.statusHistory.push({
      status: 'interview_scheduled',
      changedBy: req.user._id,
      note: notes || 'Interview scheduled.',
    });
    await application.save();

    // Notify applicant
    const notification = await Notification.create({
      recipient: application.applicant._id,
      sender: req.user._id,
      type: 'interview_scheduled',
      title: 'Interview Scheduled',
      message: `Interview scheduled for ${application.job.title} on ${interviewDate.toLocaleString()}`,
      link: '/dashboard/interviews',
    });

    req.app.get('io')?.sendNotification?.(String(application.applicant._id), notification);

    sendSuccess(res, 200, 'Interview scheduled.', { data: { application } });
  } catch (error) {
    next(error);
  }
};
