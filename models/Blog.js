const mongoose = require('mongoose');
const slugify = require('slugify');

const blogSchema = new mongoose.Schema(
  {
    title:    { type: String, required: true, trim: true },
    slug:     { type: String, unique: true },
    content:  { type: String, required: true },
    excerpt:  { type: String, maxlength: 300 },
    author:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, required: true },
    tags:     [String],
    thumbnail:{ url: String, public_id: String },
    status:   { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    views:    { type: Number, default: 0 },
    likes:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [
      {
        user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name:      String,
        email:     String,
        content:   String,
        isApproved:{ type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    metaTitle:       String,
    metaDescription: String,
    isFeatured:      { type: Boolean, default: false },
    publishedAt:     Date,
    readTime:        Number,
  },
  { timestamps: true }
);

blogSchema.index({ slug: 1 });
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1 });
blogSchema.index({ title: 'text', content: 'text', tags: 'text' });

blogSchema.pre('save', async function (next) {
  if (!this.isModified('title')) return next();
  const base = slugify(this.title, { lower: true, strict: true });
  const count = await mongoose.model('Blog').countDocuments({ slug: new RegExp(`^${base}`) });
  this.slug = count ? `${base}-${Date.now()}` : base;
  if (this.status === 'published' && !this.publishedAt) this.publishedAt = new Date();
  const wordsPerMin = 200;
  this.readTime = Math.ceil((this.content?.split(' ').length || 0) / wordsPerMin);
  next();
});

module.exports = mongoose.model('Blog', blogSchema);
