const mongoose = require('mongoose');
const slugify = require('slugify');

const socialLinksSchema = new mongoose.Schema(
  {
    facebook: { type: String, trim: true },
    instagram: { type: String, trim: true },
    linkedin: { type: String, trim: true },
    twitter: { type: String, trim: true },
    youtube: { type: String, trim: true },
  },
  { _id: false }
);

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
    socialLinks:     { type: socialLinksSchema, default: () => ({}) },
    relatedPosts:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Blog' }],
  },
  { timestamps: true }
);

blogSchema.index({ slug: 1 });
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1 });
blogSchema.index({ title: 'text', content: 'text', tags: 'text' });
blogSchema.index({ relatedPosts: 1 });

function buildUniqueSlug(title) {
  const base = slugify(title || '', { lower: true, strict: true });
  return base ? `${base}-${Date.now()}` : `${Date.now()}`;
}

async function prepareBlogDocument(doc) {
  if (!doc) return;

  if (doc.isModified?.('title')) {
    doc.slug = buildUniqueSlug(doc.title);
  }

  if ((doc.isModified?.('status') || doc.isNew) && doc.status === 'published' && !doc.publishedAt) {
    doc.publishedAt = new Date();
  }

  if (doc.isModified?.('content') || doc.isNew) {
    const wordsPerMin = 200;
    doc.readTime = Math.max(1, Math.ceil((doc.content?.trim().split(/\s+/).filter(Boolean).length || 0) / wordsPerMin));
  }
}

blogSchema.pre('save', async function (next) {
  await prepareBlogDocument(this);
  next();
});

blogSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() || {};
  const nextValues = update.$set || update;

  if (nextValues.title) {
    nextValues.slug = buildUniqueSlug(nextValues.title);
  }

  if (nextValues.status === 'published' && !nextValues.publishedAt) {
    const current = await this.model.findOne(this.getQuery()).select('publishedAt');
    nextValues.publishedAt = current?.publishedAt || new Date();
  }

  if (typeof nextValues.content === 'string') {
    const wordsPerMin = 200;
    nextValues.readTime = Math.max(1, Math.ceil((nextValues.content.trim().split(/\s+/).filter(Boolean).length || 0) / wordsPerMin));
  }

  if (update.$set) update.$set = nextValues;
  else this.setUpdate(nextValues);

  next();
});

module.exports = mongoose.model('Blog', blogSchema);
