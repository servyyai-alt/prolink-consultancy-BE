const mongoose = require('mongoose');
const slugify = require('slugify');

const serviceSchema = new mongoose.Schema(
  {
    name:             { type: String, required: true, trim: true },
    slug:             { type: String, unique: true },
    description:      { type: String, required: true },
    shortDescription: String,
    icon:             String,
    image:            { url: String, public_id: String },
    category:         String,

    features: [{ title: String, description: String, icon: String }],

    process: [{ step: Number, title: String, description: String, icon: String }],

    pricing: [
      {
        plan:        String,
        price:       Number,
        currency:    { type: String, default: 'INR' },
        period:      String,
        features:    [String],
        isPopular:   Boolean,
        isActive:    { type: Boolean, default: true },
      },
    ],

    faqs: [{ question: String, answer: String }],

    isActive: { type: Boolean, default: true },
    order:    { type: Number, default: 0 },

    metaTitle:       String,
    metaDescription: String,
  },
  { timestamps: true }
);

serviceSchema.pre('save', async function (next) {
  if (!this.isModified('name')) return next();
  this.slug = slugify(this.name, { lower: true, strict: true });
  next();
});

module.exports = mongoose.model('Service', serviceSchema);
