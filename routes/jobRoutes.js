const express = require('express');
const router = express.Router();
const {
  getJobs, getJobBySlug, createJob, updateJob, deleteJob, getCategories, getMyJobs,
} = require('../controllers/jobController');
const { protect, authorize, optionalAuth } = require('../middlewares/auth');

router.get('/', optionalAuth, getJobs);
router.get('/categories', getCategories);
router.get('/my-jobs', protect, authorize('employer', 'admin', 'super_admin', 'recruiter'), getMyJobs);
router.get('/:slug', optionalAuth, getJobBySlug);
router.post('/', protect, authorize('employer', 'admin', 'super_admin', 'recruiter'), createJob);
router.put('/:id', protect, authorize('employer', 'admin', 'super_admin', 'recruiter'), updateJob);
router.delete('/:id', protect, authorize('employer', 'admin', 'super_admin'), deleteJob);

module.exports = router;
