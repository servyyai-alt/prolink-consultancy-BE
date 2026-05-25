const express = require('express');
const router = express.Router();
const ContactInquiry = require('../models/ContactInquiry');
const { sendSuccess } = require('../utils/response');
const { sendEmail, sendInBackground } = require('../utils/emailService');

router.post('/', async (req, res, next) => {
  try {
    const inquiry = await ContactInquiry.create({
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    sendSuccess(res, 201, 'Inquiry submitted. We will get back to you soon.', { data: { inquiry } });
    sendInBackground(
      () => sendEmail({
        to: process.env.EMAIL_USER,
        subject: `New Contact Inquiry: ${req.body.subject}`,
        html: `<p>From: ${req.body.name} (${req.body.email})</p><p>Service: ${req.body.service}</p><p>${req.body.message}</p>`,
      }),
      'Contact inquiry email'
    );
  } catch (e) { next(e); }
});

module.exports = router;
