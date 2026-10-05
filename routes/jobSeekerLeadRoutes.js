const express = require('express');
const router = express.Router();
const ContactInquiry = require('../models/ContactInquiry');
const { anyUpload } = require('../middlewares/upload');
const { cloudinary } = require('../config/cloudinary');
const { sendSuccess, sendError } = require('../utils/response');

// POST /api/v1/job-seeker-leads
// Public endpoint - homepage form submission with optional resume upload
router.post('/', anyUpload.single('resume'), async (req, res, next) => {
  try {
    const { name, email, phone, currentRole, experience, skills, location, message } = req.body;

    if (!name || !name.trim()) return sendError(res, 400, 'Name is required.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(res, 400, 'Valid email is required.');
    if (!phone || !phone.trim()) return sendError(res, 400, 'Phone number is required.');

    let resumeUrl = null;
    let resumeOriginalName = null;
    if (req.file) {
      resumeOriginalName = req.file.originalname;
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: 'raw', folder: 'prolink/job-seeker-leads' },
          (error, result) => {
            if (error) return reject(new Error(`Resume upload failed: ${error.message}`));
            resolve(result);
          },
        );
        stream.end(req.file.buffer);
      });
      resumeUrl = uploadResult.secure_url;
    }

    const skillsArr = typeof skills === 'string' ? skills.split(',').map((s) => s.trim()).filter(Boolean) : [];

    const subject = `Job Seeker Lead: ${name.trim()} - ${currentRole || 'Job Seeker'}`;
    const messageBody = [
      `Name: ${name.trim()}`,
      `Email: ${email.trim()}`,
      `Phone: ${phone.trim()}`,
      currentRole    ? `Current Role: ${currentRole}` : '',
      experience     ? `Experience: ${experience}` : '',
      location       ? `Location: ${location}` : '',
      skillsArr.length ? `Skills: ${skillsArr.join(', ')}` : '',
      message        ? `Message: ${message}` : '',
      resumeOriginalName ? `Resume File: ${resumeOriginalName}` : '',
      resumeUrl      ? `Resume: ${resumeUrl}` : 'Resume: Not uploaded',
    ].filter(Boolean).join('\n');

    await ContactInquiry.create({
      name:      name.trim(),
      email:     email.trim().toLowerCase(),
      phone:     phone.trim(),
      subject,
      message:   messageBody,
      service:   resumeUrl || undefined,
      resumeOriginalName: resumeOriginalName || undefined,
      source:    'job_seeker_lead',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    sendSuccess(res, 201, 'Your details have been submitted. Our team will contact you soon!');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
