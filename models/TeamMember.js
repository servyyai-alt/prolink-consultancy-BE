const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    bio: { type: String, trim: true, default: '' },
    linkedinUrl: { type: String, trim: true, default: '' },
    image: {
      url: { type: String, trim: true, default: '' },
      public_id: { type: String, trim: true, default: '' },
    },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

teamMemberSchema.index({ isActive: 1, order: 1, createdAt: -1 });

module.exports = mongoose.model('TeamMember', teamMemberSchema);
