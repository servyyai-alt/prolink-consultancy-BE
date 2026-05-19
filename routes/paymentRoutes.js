const express = require('express');
const router = express.Router();
const { createRazorpayOrder, verifyRazorpayPayment, createStripeIntent, stripeWebhook, getMyPayments } = require('../controllers/paymentController');
const { protect } = require('../middlewares/auth');
const express2 = require('express');

router.post('/razorpay/create-order', protect, createRazorpayOrder);
router.post('/razorpay/verify', protect, verifyRazorpayPayment);
router.post('/stripe/create-intent', protect, createStripeIntent);
router.post('/stripe/webhook', express2.raw({ type: 'application/json' }), stripeWebhook);
router.get('/my-payments', protect, getMyPayments);

module.exports = router;