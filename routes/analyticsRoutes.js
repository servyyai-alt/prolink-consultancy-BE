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