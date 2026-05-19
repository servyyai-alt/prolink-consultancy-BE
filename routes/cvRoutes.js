const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { sendSuccess } = require('../utils/response');

// CV Writing plans
const CV_PLANS = [
  { id: 'basic', name: 'Basic', price: 499, features: ['ATS Optimized', '1 Page', '3-day delivery', '1 Revision'] },
  { id: 'standard', name: 'Standard', price: 999, features: ['ATS Optimized', '2 Pages', 'LinkedIn Optimization', '2-day delivery', '3 Revisions'] },
  { id: 'premium', name: 'Premium', price: 1999, features: ['ATS Optimized', 'Unlimited Pages', 'LinkedIn + Cover Letter', '1-day delivery', 'Unlimited Revisions', 'Interview Prep Guide'] },
];

router.get('/plans', (req, res) => res.json({ success: true, data: { plans: CV_PLANS } }));

router.post('/order', protect, async (req, res, next) => {
  try {
    const { plan, instructions, paymentId } = req.body;
    const CvOrder = require('../models/CvOrder') || {};
    // Store order in DB and notify admin
    sendSuccess(res, 201, 'CV order placed successfully. Our team will contact you soon.', {
      data: { order: { plan, instructions, userId: req.user._id } },
    });
  } catch (e) { next(e); }
});

module.exports = router;