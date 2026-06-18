const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const User = require('../models/User');
const { cloudinary, uploadToCloudinary } = require('../config/cloudinary');
const { imageUpload, resumeUpload } = require('../middlewares/upload');
const { sendSuccess, sendError } = require('../utils/response');
const fs = require('fs');

const copyAllowed = (target, source, allowedFields, prefix = '') => {
  if (!source || typeof source !== 'object') return;

  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      target[prefix ? `${prefix}.${field}` : field] = source[field];
    }
  });
};

const getProfileUpdates = (body) => {
  const set = {};
  const unset = {};

  copyAllowed(set, body, ['firstName', 'lastName', 'phone']);
  copyAllowed(set, body.profile, [
    'headline',
    'summary',
    'location',
    'website',
    'linkedin',
    'github',
    'skills',
    'experience',
    'education',
    'languages',
  ], 'profile');

  if (body.profile && Object.prototype.hasOwnProperty.call(body.profile, 'availability')) {
    if (body.profile.availability) {
      set['profile.availability'] = body.profile.availability;
    } else {
      unset['profile.availability'] = '';
    }
  }

  copyAllowed(set, body.company, [
    'name',
    'website',
    'industry',
    'size',
    'description',
    'location',
    'gstin',
  ], 'company');

  const update = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;
  return update;
};

const cleanupFile = (file) => {
  if (file?.path) fs.unlink(file.path, () => {});
};

router.get('/profile', protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  sendSuccess(res, 200, 'Profile fetched.', { data: { user } });
});

router.put('/profile', protect, async (req, res, next) => {
  try {
    const update = getProfileUpdates(req.body);
    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true });
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
    cleanupFile(req.file);
    const user = await User.findByIdAndUpdate(req.user._id, { avatar: result }, { new: true });
    sendSuccess(res, 200, 'Avatar uploaded.', { data: { avatar: result, user } });
  } catch (e) {
    cleanupFile(req.file);
    next(e);
  }
});

router.post('/upload-company-logo', protect, imageUpload.single('logo'), async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.');
    const result = await uploadToCloudinary(req.file.path, 'prolink/company-logos', { width: 300, height: 300, crop: 'fill' });
    cleanupFile(req.file);
    const user = await User.findByIdAndUpdate(req.user._id, { 'company.logo': result }, { new: true });
    sendSuccess(res, 200, 'Company logo uploaded.', { data: { logo: result, user } });
  } catch (e) {
    cleanupFile(req.file);
    next(e);
  }
});

router.post('/upload-resume', protect, resumeUpload.single('resume'), async (req, res, next) => {
  try {
    if (!req.file) return sendError(res, 400, 'No file uploaded.');
    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: 'raw',
      folder: 'prolink/resumes',
    });
    cleanupFile(req.file);
    const resume = {
      url: result.secure_url,
      public_id: result.public_id,
      uploadedAt: new Date(),
    };
    const user = await User.findByIdAndUpdate(req.user._id, { 'profile.resume': resume }, { new: true });
    sendSuccess(res, 200, 'Resume uploaded.', { data: { resume, user } });
  } catch (e) {
    cleanupFile(req.file);
    next(e);
  }
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
    const user = await User.findById(req.user._id).populate('savedJobs', 'title company location state district address type salary slug status');
    sendSuccess(res, 200, 'Saved jobs fetched.', { data: { savedJobs: user.savedJobs } });
  } catch (e) { next(e); }
});

module.exports = router;
