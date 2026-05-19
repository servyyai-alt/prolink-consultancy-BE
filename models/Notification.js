const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: [
        'job_application', 'application_status', 'interview_scheduled',
        'offer_received', 'job_posted', 'profile_viewed', 'message',
        'payment_success', 'payment_failed', 'account_verified',
        'password_changed', 'system', 'promotion',
      ],
      required: true,
    },
    title:   { type: String, required: true },
    message: { type: String, required: true },
    data:    { type: Map, of: mongoose.Schema.Types.Mixed },
    link:    String,
    isRead:  { type: Boolean, default: false },
    readAt:  Date,
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
