const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName:  { type: String, required: true, trim: true, maxlength: 50 },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:     { type: String, trim: true },
    password:  { type: String, required: true, minlength: 8, select: false },

    role: {
      type: String,
      enum: ['super_admin', 'admin', 'recruiter', 'employer', 'job_seeker'],
      default: 'job_seeker',
    },

    avatar:    { url: String, public_id: String },
    isActive:  { type: Boolean, default: true },
    isVerified:{ type: Boolean, default: false },
    // Admin approval for employer accounts (required to post jobs)
    isApproved: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },

    // Profile details
    profile: {
      headline:   String,
      summary:    String,
      location:   String,
      website:    String,
      linkedin:   String,
      github:     String,
      skills:     [String],
      experience: String,
      education:  String,
      resume: { url: String, public_id: String, uploadedAt: Date },
      atsScore:   { type: Number, default: 0 },
      languages:  [String],
      availability: { type: String, enum: ['immediate', 'within_month', 'flexible', 'not_looking'] },
    },

    // Employer specific
    company: {
      name:        String,
      logo:        { url: String, public_id: String },
      website:     String,
      industry:    String,
      size:        String,
      description: String,
      location:    String,
      gstin:       String,
    },

    // Auth tokens
    otp:             { code: String, expiry: Date },
    refreshToken:    { type: String, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpiry: Date,

    // Activity
    lastLogin:    Date,
    savedJobs:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job' }],
    notifications:[{ type: mongoose.Schema.Types.ObjectId, ref: 'Notification' }],

    // Subscription
    subscription: {
      plan:      { type: String, enum: ['free', 'basic', 'premium', 'enterprise'], default: 'free' },
      startDate: Date,
      endDate:   Date,
      isActive:  { type: Boolean, default: false },
      paymentId: String,
    },

    // Social login
    googleId:   String,
    linkedinId: String,

    // Meta
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    metadata:   { type: Map, of: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ 'profile.skills': 1 });
userSchema.index({ createdAt: -1 });

// Virtual: full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate OTP
userSchema.methods.generateOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = {
    code: otp,
    expiry: new Date(Date.now() + parseInt(process.env.OTP_EXPIRE_MINUTES || 10) * 60 * 1000),
  };
  return otp;
};

// Generate password reset token
userSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpiry = new Date(Date.now() + 30 * 60 * 1000);
  return resetToken;
};

module.exports = mongoose.model('User', userSchema);
