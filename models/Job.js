const mongoose = require('mongoose');
const slugify = require('slugify');

const jobSchema = new mongoose.Schema(
  {
    title:       { type: String, required: true, trim: true },
    slug:        { type: String, unique: true },
    description: { type: String, required: true },
    requirements:{ type: String },
    responsibilities: { type: String },

    company: {
      name:        { type: String, required: true },
      logo:        String,
      website:     String,
      description: String,
    },

    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    location:    { type: String, required: true },
    state:       { type: String, trim: true },
    district:    { type: String, trim: true },
    address:     { type: String, trim: true },
    locationType:{ type: String, enum: ['onsite', 'remote', 'hybrid'], default: 'onsite' },

    category:    { type: String, required: true },
    subCategory: String,
    type:        { type: String, enum: ['full_time', 'part_time', 'contract', 'internship', 'freelance'], default: 'full_time' },

    experience: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 5 },
      label: String,
    },

    salary: {
      min:      Number,
      max:      Number,
      currency: { type: String, default: 'INR' },
      period:   { type: String, enum: ['hourly', 'monthly', 'yearly'], default: 'yearly' },
      isVisible:{ type: Boolean, default: true },
    },

    skills:    [String],
    education: String,
    openings:  { type: Number, default: 1 },

    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'closed', 'expired'],
      default: 'active',
    },

    deadline:   Date,
    featured:   { type: Boolean, default: false },
    urgent:     { type: Boolean, default: false },

    views:       { type: Number, default: 0 },
    applications:{ type: Number, default: 0 },

    tags:        [String],

    // SEO
    metaTitle:       String,
    metaDescription: String,

    isDeleted:   { type: Boolean, default: false },
    deletedAt:   Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
jobSchema.index({ slug: 1 });
jobSchema.index({ status: 1, isDeleted: 1 });
jobSchema.index({ category: 1 });
jobSchema.index({ 'experience.min': 1, 'experience.max': 1 });
jobSchema.index({ 'salary.min': 1, 'salary.max': 1 });
jobSchema.index({ skills: 1 });
jobSchema.index({ featured: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ title: 'text', description: 'text', skills: 'text' });

// Auto-generate slug
jobSchema.pre('save', async function (next) {
  if (!this.isModified('title')) return next();
  const base = slugify(this.title, { lower: true, strict: true });
  const existing = await mongoose.model('Job').countDocuments({ slug: new RegExp(`^${base}`) });
  this.slug = existing ? `${base}-${Date.now()}` : base;
  next();
});

module.exports = mongoose.model('Job', jobSchema);
