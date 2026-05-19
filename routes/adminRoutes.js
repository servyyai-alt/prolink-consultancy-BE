const express = require('express');
const router = express.Router();
const {
  getDashboardStats, getUsers, toggleBlockUser, changeUserRole,
  getContacts, getPayments, getApplications, getBlogs, getServices, getTestimonials, approveTestimonial,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middlewares/auth');

const adminOnly = [protect, authorize('admin', 'super_admin', 'recruiter')];

router.get('/dashboard-stats', ...adminOnly, getDashboardStats);
router.get('/users', ...adminOnly, getUsers);
router.patch('/users/:id/block', ...adminOnly, toggleBlockUser);
router.patch('/users/:id/role', ...adminOnly, changeUserRole);
router.get('/contacts', ...adminOnly, getContacts);
router.get('/payments', ...adminOnly, getPayments);
router.get('/applications', ...adminOnly, getApplications);
router.get('/blogs', ...adminOnly, getBlogs);
router.get('/services', ...adminOnly, getServices);
router.get('/testimonials', ...adminOnly, getTestimonials);
router.patch('/testimonials/:id/approve', ...adminOnly, approveTestimonial);

module.exports = router;
