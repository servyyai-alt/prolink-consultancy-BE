const express = require('express');
const router = express.Router();
const Testimonial = require('../models/Testimonial');
const { protect } = require('../middlewares/auth');
const { sendSuccess, sendPaginated } = require('../utils/response');

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 9, featured } = req.query;
    const query = { isApproved: true };
    if (featured === 'true') query.isFeatured = true;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [testimonials, total] = await Promise.all([
      Testimonial.find(query).sort('order -createdAt').skip(skip).limit(parseInt(limit)),
      Testimonial.countDocuments(query),
    ]);
    sendPaginated(res, testimonials, total, page, limit);
  } catch (e) { next(e); }
});

router.post('/', protect, async (req, res, next) => {
  try {
    const t = await Testimonial.create({ ...req.body, user: req.user._id });
    sendSuccess(res, 201, 'Testimonial submitted. Pending approval.', { data: { testimonial: t } });
  } catch (e) { next(e); }
});

module.exports = router;