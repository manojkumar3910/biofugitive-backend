const mongoose = require("mongoose");

const evidenceSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['photo', 'document', 'fingerprint', 'video', 'audio', 'other'],
    required: true,
  },
  filename: String,
  originalName: String,
  mimeType: String,
  size: Number,
  description: String,
  uploadedBy: String,
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  metadata: mongoose.Schema.Types.Mixed,
});

const timelineEntrySchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
  },
  description: String,
  performedBy: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
  metadata: mongoose.Schema.Types.Mixed,
});

const noteSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
  },
  createdBy: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: Date,
  isPrivate: {
    type: Boolean,
    default: false,
  },
});

const caseSchema = new mongoose.Schema({
  caseNumber: {
    type: String,
    required: true,
    unique: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: String,
  type: {
    type: String,
    enum: ['criminal', 'civil', 'investigation', 'surveillance', 'missing_person', 'other'],
    default: 'investigation',
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'pending', 'closed', 'archived'],
    default: 'open',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  assignedOfficers: [{
    odviserId: String,
    name: String,
    role: String,
    assignedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  leadOfficer: {
    odviserId: String,
    name: String,
  },
  suspects: [{
    personId: String,
    name: String,
    role: {
      type: String,
      enum: ['suspect', 'person_of_interest', 'witness', 'victim', 'informant'],
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    notes: String,
  }],
  evidence: [evidenceSchema],
  notes: [noteSchema],
  timeline: [timelineEntrySchema],
  location: {
    address: String,
    city: String,
    state: String,
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },
  dateOccurred: Date,
  dateReported: Date,
  dateClosed: Date,
  relatedCases: [{
    caseId: mongoose.Schema.Types.ObjectId,
    caseNumber: String,
    relationship: String,
  }],
  tags: [String],
  createdBy: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Auto-generate case number
caseSchema.pre('save', async function(next) {
  if (this.isNew && !this.caseNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments();
    this.caseNumber = `CASE-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  this.updatedAt = new Date();
  next();
});

// Add timeline entry method
caseSchema.methods.addTimelineEntry = function(action, description, performedBy, metadata = {}) {
  this.timeline.push({
    action,
    description,
    performedBy,
    timestamp: new Date(),
    metadata,
  });
};

module.exports = mongoose.model("Case", caseSchema);
