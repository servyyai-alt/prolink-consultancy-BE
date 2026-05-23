const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    job:       { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    employer:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    resume:      { url: String, public_id: String },
    coverLetter: String,

    status: {
      type: String,
      enum: ['applied', 'screening', 'shortlisted', 'interview_scheduled', 'offered', 'hired', 'rejected', 'withdrawn'],
      default: 'applied',
    },

    statusHistory: [
      {
        status:    String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note:      String,
        changedAt: { type: Date, default: Date.now },
      },
    ],

    interview: {
      scheduledAt: Date,
      type:        { type: String, enum: ['phone', 'video', 'in_person', 'technical'] },
      link:        String,
      location:    String,
      notes:       String,
      feedback:    String,
      rating:      { type: Number, min: 1, max: 5 },
    },

    offer: {
      salary:    Number,
      joiningDate: Date,
      letter:    String,
      isAccepted:{ type: Boolean },
      acceptedAt: Date,
    },

    screening: {
      answers: [{ question: String, answer: String }],
      score:   Number,
    },

    notes:     String,
    isRead:    { type: Boolean, default: false },
    isFlagged: { type: Boolean, default: false },

    withdrawnReason: String,
    rejectedReason:  String,
  },
  { timestamps: true }
);

applicationSchema.index({ job: 1, applicant: 1 }, { unique: true });
applicationSchema.index({ employer: 1, status: 1 });
applicationSchema.index({ applicant: 1, status: 1 });
applicationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Application', applicationSchema);
