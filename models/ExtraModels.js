const mongoose = require('mongoose')

// ── CvOrder ───────────────────────────────────────────────────────────────────
const cvOrderSchema = new mongoose.Schema({
  user:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan:             { type: String, enum: ['basic', 'standard', 'premium'], required: true },
  price:            { type: Number, required: true },
  originalResume:   { url: String, public_id: String },
  deliveredResume:  { url: String, public_id: String },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'delivered', 'revision_requested', 'completed'],
    default: 'pending',
  },
  instructions:     String,
  payment:          { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  deadline:         Date,
  atsScore:         { before: Number, after: Number },
  revisions:        [{ requestedAt: Date, notes: String, deliveredAt: Date }],
  deliveredAt:      Date,
  assignedTo:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

const CvOrder = mongoose.model('CvOrder', cvOrderSchema)

// ── AuditLog ──────────────────────────────────────────────────────────────────
const auditLogSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action:     { type: String, required: true },
  resource:   String,
  resourceId: String,
  oldData:    mongoose.Schema.Types.Mixed,
  newData:    mongoose.Schema.Types.Mixed,
  ipAddress:  String,
  userAgent:  String,
}, { timestamps: true })

auditLogSchema.index({ user: 1, createdAt: -1 })
auditLogSchema.index({ resource: 1, resourceId: 1 })

const AuditLog = mongoose.model('AuditLog', auditLogSchema)

// ── CampusDrive ───────────────────────────────────────────────────────────────
const campusDriveSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  company:     { type: String, required: true },
  logo:        String,
  description: String,
  date:        { type: Date, required: true },
  venue:       String,
  eligibility: {
    cgpa:       Number,
    branches:  [String],
    skills:    [String],
    passoutYear: Number,
  },
  slots:      { type: Number, default: 100 },
  registered: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, registeredAt: Date }],
  status:     { type: String, enum: ['upcoming', 'ongoing', 'completed', 'cancelled'], default: 'upcoming' },
  isPublished:{ type: Boolean, default: false },
  postedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  results:    [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, status: String, package: Number }],
}, { timestamps: true })

const CampusDrive = mongoose.model('CampusDrive', campusDriveSchema)

// ── EventBooking ──────────────────────────────────────────────────────────────
const eventSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  slug:        { type: String, unique: true },
  description: String,
  category:    { type: String, enum: ['corporate', 'wedding', 'birthday', 'conference', 'exhibition', 'other'] },
  images:      [{ url: String, public_id: String }],
  packages:    [{
    name:      String,
    price:     Number,
    features:  [String],
    maxGuests: Number,
  }],
  status:      { type: String, enum: ['active', 'inactive'], default: 'active' },
  postedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

const Event = mongoose.model('Event', eventSchema)

module.exports = { CvOrder, AuditLog, CampusDrive, Event }
