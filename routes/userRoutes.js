const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const User = require('../models/User');
const { uploadToCloudinary } = require('../config/cloudinary');
const { imageUpload, resumeUpload } = require('../middlewares/upload');
const { sendSuccess, sendError } = require('../utils/response');

router.get('/profile', protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  sendSuccess(res, 200, 'Profile fetched.', { data: { user } });
});

router.put('/profile', protect, async (req, res, next) => {
  try {
    const updates = req.body;
    delete updates.password; delete updates.role; delete updates.email;
    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true });
    sendSuccess(res, 200, 'Profile updated.', { data: { user } });
  } catch (e) { next(e); }
});

router.put('/change-password', protect, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) return sendError(res, 400, 'Current password is incorrect.');
    user.password = newPassword;
    await user.save();
    sendSuccess(res, 200, 'Password changed successfully.');
  } catch (e) { next(e); }
});

router.post('/upload-avatar', protect, imageUpload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.');
    const result = await uploadToCloudinary(req.file.path, 'prolink/avatars', { width: 300, height: 300, crop: 'fill' });
    await User.findByIdAndUpdate(req.user._id, { avatar: result });
    sendSuccess(res, 200, 'Avatar uploaded.', { data: { avatar: result } });
  } catch (e) { next(e); }
});

router.post('/upload-resume', protect, resumeUpload.single('resume'), async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.');
    const result = await uploadToCloudinary(req.file.path, 'prolink/resumes', { resource_type: 'raw' });
    await User.findByIdAndUpdate(req.user._id, { 'profile.resume': { ...result, uploadedAt: new Date() } });
    sendSuccess(res, 200, 'Resume uploaded.', { data: { resume: result } });
  } catch (e) { next(e); }
});

router.post('/save-job/:jobId', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const isSaved = user.savedJobs.includes(req.params.jobId);
    if (isSaved) {
      user.savedJobs.pull(req.params.jobId);
    } else {
      user.savedJobs.push(req.params.jobId);
    }
    await user.save();
    sendSuccess(res, 200, isSaved ? 'Job unsaved.' : 'Job saved.', { data: { saved: !isSaved } });
  } catch (e) { next(e); }
});

router.get('/saved-jobs', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('savedJobs', 'title company location type salary slug status');
    sendSuccess(res, 200, 'Saved jobs fetched.', { data: { savedJobs: user.savedJobs } });
  } catch (e) { next(e); }
});

module.exports = router;