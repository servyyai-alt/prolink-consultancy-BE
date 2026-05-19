const Razorpay = require('razorpay');
const Stripe = require('stripe');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const { sendSuccess, sendError } = require('../utils/response');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// @POST /api/v1/payments/razorpay/create-order
exports.createRazorpayOrder = async (req, res, next) => {
  try {
    const { amount, currency = 'INR', type, referenceId, description } = req.body;

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // in paise
      currency,
      receipt: `receipt_${Date.now()}`,
      notes: { userId: req.user._id.toString(), type },
    });

    const payment = await Payment.create({
      user: req.user._id,
      orderId: order.id,
      amount,
      currency,
      status: 'pending',
      gateway: 'razorpay',
      type,
      referenceId,
      description,
    });

    sendSuccess(res, 200, 'Order created.', {
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        paymentId: payment._id,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @POST /api/v1/payments/razorpay/verify
exports.verifyRazorpayPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return sendError(res, 400, 'Payment verification failed.');
    }

    const payment = await Payment.findOneAndUpdate(
      { orderId: razorpay_order_id },
      { paymentId: razorpay_payment_id, signature: razorpay_signature, status: 'completed' },
      { new: true }
    );

    sendSuccess(res, 200, 'Payment verified successfully.', { data: { payment } });
  } catch (error) {
    next(error);
  }
};

// @POST /api/v1/payments/stripe/create-intent
exports.createStripeIntent = async (req, res, next) => {
  try {
    const { amount, currency = 'inr', type, referenceId, description } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      metadata: { userId: req.user._id.toString(), type },
      description,
    });

    const payment = await Payment.create({
      user: req.user._id,
      orderId: paymentIntent.id,
      amount,
      currency: currency.toUpperCase(),
      status: 'pending',
      gateway: 'stripe',
      type,
      referenceId,
      description,
    });

    sendSuccess(res, 200, 'Payment intent created.', {
      data: { clientSecret: paymentIntent.client_secret, paymentId: payment._id },
    });
  } catch (error) {
    next(error);
  }
};

// @POST /api/v1/payments/stripe/webhook
exports.stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    await Payment.findOneAndUpdate({ orderId: pi.id }, { status: 'completed', paymentId: pi.id });
  }

  res.json({ received: true });
};

// @GET /api/v1/payments/my-payments
exports.getMyPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find({ user: req.user._id }).sort('-createdAt').limit(20);
    sendSuccess(res, 200, 'Payments fetched.', { data: { payments } });
  } catch (error) {
    next(error);
  }
};
