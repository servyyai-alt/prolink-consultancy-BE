const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true },
    designation: String,
    company:     String,
    avatar:      { url: String, public_id: String },
    content:     { type: String, required: true },
    rating:      { type: Number, min: 1, max: 5, default: 5 },
    service:     { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    isApproved:  { type: Boolean, default: false },
    isFeatured:  { type: Boolean, default: false },
    order:       { type: Number, default: 0 },
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

testimonialSchema.index({ isApproved: 1, isFeatured: 1 });

module.exports = mongoose.model('Testimonial', testimonialSchema);
