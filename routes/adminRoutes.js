const express = require('express');
const router = express.Router();
const {
  getDashboardStats, getUsers, createUser, toggleBlockUser, changeUserRole, deleteUser, approveUser,
  getContacts, updateContact, getPayments, getApplications, getBlogs, getServices, getTeamMembers, getTestimonials, approveTestimonial, updateTestimonial, deleteTestimonial,
  getJobApplicantResumes, getAllJobSeekerResumes, getJobSeekerLeads, updateJobSeekerLead,
  downloadLeadResume,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middlewares/auth');

const adminOnly = [protect, authorize('admin', 'super_admin', 'recruiter')];

router.get('/dashboard-stats', ...adminOnly, getDashboardStats);
router.get('/users', ...adminOnly, getUsers);
router.post('/users', ...adminOnly, createUser);
router.patch('/users/:id/block', ...adminOnly, toggleBlockUser);
router.patch('/users/:id/role', ...adminOnly, changeUserRole);
router.patch('/users/:id/approve', ...adminOnly, approveUser);
router.delete('/users/:id', ...adminOnly, deleteUser);
router.get('/contacts', ...adminOnly, getContacts);
router.patch('/contacts/:id', ...adminOnly, updateContact);
router.get('/payments', ...adminOnly, getPayments);
router.get('/applications', ...adminOnly, getApplications);
router.get('/blogs', ...adminOnly, getBlogs);
router.get('/services', ...adminOnly, getServices);
router.get('/team-members', ...adminOnly, getTeamMembers);
router.get('/testimonials', ...adminOnly, getTestimonials);
router.patch('/testimonials/:id/approve', ...adminOnly, approveTestimonial);
router.patch('/testimonials/:id', ...adminOnly, updateTestimonial);
router.delete('/testimonials/:id', ...adminOnly, deleteTestimonial);
router.get('/jobs/:jobId/resumes/download', ...adminOnly, getJobApplicantResumes);
router.get('/resumes/download-all', ...adminOnly, getAllJobSeekerResumes);
router.get('/job-seeker-leads', ...adminOnly, getJobSeekerLeads);
router.get('/job-seeker-leads/:id/resume/download', ...adminOnly, downloadLeadResume);
router.patch('/job-seeker-leads/:id', ...adminOnly, updateJobSeekerLead);

module.exports = router;

