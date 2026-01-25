const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    unique: true,
  },
  title: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: [
      'case_summary', 'person_profile', 'match_report',
      'analytics', 'audit_report', 'watchlist_report',
      'activity_report', 'custom',
    ],
    required: true,
  },
  format: {
    type: String,
    enum: ['pdf', 'csv', 'excel', 'json'],
    default: 'pdf',
  },
  status: {
    type: String,
    enum: ['pending', 'generating', 'completed', 'failed'],
    default: 'pending',
  },
  parameters: mongoose.Schema.Types.Mixed, // Query parameters used
  data: mongoose.Schema.Types.Mixed, // Report data
  filename: String,
  filePath: String,
  fileSize: Number,
  generatedBy: String,
  generatedAt: Date,
  expiresAt: Date,
  downloadCount: {
    type: Number,
    default: 0,
  },
  isScheduled: {
    type: Boolean,
    default: false,
  },
  scheduleConfig: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
    },
    dayOfWeek: Number,
    dayOfMonth: Number,
    time: String,
    recipients: [String],
    lastRun: Date,
    nextRun: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Auto-generate report ID
reportSchema.pre('save', async function(next) {
  if (this.isNew && !this.reportId) {
    const count = await this.constructor.countDocuments();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    this.reportId = `RPT-${date}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model("Report", reportSchema);
