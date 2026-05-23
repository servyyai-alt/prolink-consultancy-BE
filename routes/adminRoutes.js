const express = require('express');
const router = express.Router();
const {
  getDashboardStats, getUsers, createUser, toggleBlockUser, changeUserRole, deleteUser,
  getContacts, getPayments, getApplications, getBlogs, getServices, getTestimonials, approveTestimonial, updateTestimonial,deleteTestimonial
} = require('../controllers/adminController');
const { protect, authorize } = require('../middlewares/auth');

const adminOnly = [protect, authorize('admin', 'super_admin', 'recruiter')];

router.get('/dashboard-stats', ...adminOnly, getDashboardStats);
router.get('/users', ...adminOnly, getUsers);
router.post('/users', ...adminOnly, createUser);
router.patch('/users/:id/block', ...adminOnly, toggleBlockUser);
router.patch('/users/:id/role', ...adminOnly, changeUserRole);
router.delete('/users/:id', ...adminOnly, deleteUser);
router.get('/contacts', ...adminOnly, getContacts);
router.get('/payments', ...adminOnly, getPayments);
router.get('/applications', ...adminOnly, getApplications);
router.get('/blogs', ...adminOnly, getBlogs);
router.get('/services', ...adminOnly, getServices);
router.get('/testimonials', ...adminOnly, getTestimonials);
router.patch('/testimonials/:id/approve', ...adminOnly, approveTestimonial);
router.patch('/testimonials/:id', ...adminOnly, updateTestimonial);
router.delete('/testimonials/:id', ...adminOnly, deleteTestimonial);

module.exports = router;
