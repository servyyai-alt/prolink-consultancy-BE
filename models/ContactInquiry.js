const mongoose = require('mongoose');

const contactInquirySchema = new mongoose.Schema(
  {
    name:    { type: String, required: true },
    email:   { type: String, required: true },
    phone:   String,
    subject: { type: String, required: true },
    message: { type: String, required: true },
    service: String,
    status:  { type: String, enum: ['new', 'read', 'replied', 'closed'], default: 'new' },
    source:  { type: String, default: 'contact_form' },
    ipAddress: String,
    userAgent: String,
    repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    repliedAt: Date,
    reply:     String,
    isSpam:    { type: Boolean, default: false },
  },
  { timestamps: true }
);

contactInquirySchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ContactInquiry', contactInquirySchema);
