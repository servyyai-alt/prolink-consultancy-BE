const express = require('express');
const router = express.Router();
const ContactInquiry = require('../models/ContactInquiry');
const { sendSuccess, sendPaginated } = require('../utils/response');
const { sendEmail, sendInBackground } = require('../utils/emailService');
const { protect, optionalAuth } = require('../middlewares/auth');
const { notifyAdmins } = require('../utils/notificationService');

router.post('/', optionalAuth, async (req, res, next) => {
  try {
    const payload = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      subject: req.body.subject,
      message: req.body.message,
      service: req.body.service,
      source: req.body.source,
      user: req.user?._id,
      statusHistory: [
        {
          status: 'new',
          note: 'Inquiry submitted',
          changedBy: req.user?._id,
        },
      ],
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };

    const inquiry = await ContactInquiry.create({
      ...payload,
    });

    await notifyAdmins(req, {
      sender: req.user?._id,
      type: 'message',
      title: 'New Contact Inquiry',
      message: `${req.body.name} submitted "${req.body.subject}".`,
      link: '/admin/contacts',
      data: {
        inquiryId: inquiry._id.toString(),
        service: req.body.service,
      },
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

router.get('/my-inquiries', protect, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { user: req.user._id };

    if (status) query.status = status;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [inquiries, total] = await Promise.all([
      ContactInquiry.find(query)
        .populate('repliedBy', 'firstName lastName email')
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit, 10)),
      ContactInquiry.countDocuments(query),
    ]);

    sendPaginated(res, inquiries, total, page, limit, 'Your contact inquiries fetched.');
  } catch (e) { next(e); }
});

module.exports = router;
