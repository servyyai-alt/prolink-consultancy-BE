const express = require('express');
const router = express.Router();
const {
  applyForJob, getMyApplications, getJobApplications,
  updateApplicationStatus, withdrawApplication, scheduleInterview,
} = require('../controllers/applicationController');
const { protect, authorize } = require('../middlewares/auth');

router.post('/', protect, authorize('job_seeker'), applyForJob);
router.get('/my-applications', protect, authorize('job_seeker'), getMyApplications);
router.get('/job/:jobId', protect, authorize('employer', 'admin', 'super_admin', 'recruiter'), getJobApplications);
router.put('/:id/status', protect, authorize('employer', 'admin', 'super_admin', 'recruiter'), updateApplicationStatus);
router.put('/:id/withdraw', protect, authorize('job_seeker'), withdrawApplication);
router.put('/:id/schedule-interview', protect, authorize('employer', 'admin', 'super_admin', 'recruiter'), scheduleInterview);

module.exports = router;
