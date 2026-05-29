const mongoose = require('mongoose');

const brochureSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Brochure name is required.'],
    trim: true,
    maxlength: [120, 'Brochure name cannot exceed 120 characters.'],
  },
  fileName: {
    type: String,
    required: true,
    trim: true,
  },
  url: {
    type: String,
    required: true,
  },
  publicId: {
    type: String,
    required: true,
  },
  mimeType: {
    type: String,
    trim: true,
  },
  size: {
    type: Number,
    default: 0,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

brochureSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Brochure', brochureSchema);
