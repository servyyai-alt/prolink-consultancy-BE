const express = require('express');
const router = express.Router();
const ContactInquiry = require('../models/ContactInquiry');
const { sendSuccess } = require('../utils/response');
const { sendEmail, sendInBackground } = require('../utils/emailService');

router.post('/inquiry', async (req, res, next) => {
  try {
    const inquiry = await ContactInquiry.create({ ...req.body, service: 'catering', source: 'catering_form' });
    sendSuccess(res, 201, 'Catering inquiry submitted.', { data: { inquiry } });
    sendInBackground(
      () => sendEmail({
        to: process.env.EMAIL_USER,
        subject: 'New Catering Inquiry',
        html: `<p>Name: ${req.body.name}</p><p>Email: ${req.body.email}</p><p>Phone: ${req.body.phone}</p><p>Event: ${req.body.message}</p>`,
      }),
      'Catering inquiry email'
    );
  } catch (e) { next(e); }
});

module.exports = router;
