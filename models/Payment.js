const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderId:    { type: String, required: true, unique: true },
    paymentId:  String,
    signature:  String,
    amount:     { type: Number, required: true },
    currency:   { type: String, default: 'INR' },
    status:     { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
    gateway:    { type: String, enum: ['razorpay', 'stripe', 'manual'], required: true },
    type: {
      type: String,
      enum: ['cv_writing', 'subscription', 'event_booking', 'catering', 'campus_drive'],
      required: true,
    },
    referenceId:    String,
    referenceModel: String,
    description:    String,
    metadata:       { type: Map, of: String },
    refundedAt:     Date,
    refundAmount:   Number,
    refundId:       String,
    invoice:        { url: String, number: String },
  },
  { timestamps: true }
);

paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ orderId: 1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
