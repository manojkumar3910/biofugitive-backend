const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      // Authentication
      'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_CHANGE',
      // Person actions
      'PERSON_VIEW', 'PERSON_CREATE', 'PERSON_UPDATE', 'PERSON_DELETE',
      'PERSON_SEARCH', 'WATCHLIST_ADD', 'WATCHLIST_REMOVE',
      // Case actions
      'CASE_VIEW', 'CASE_CREATE', 'CASE_UPDATE', 'CASE_DELETE',
      'CASE_ASSIGN', 'CASE_STATUS_CHANGE', 'EVIDENCE_ADD', 'NOTE_ADD',
      // Biometric actions
      'FINGERPRINT_SCAN', 'FINGERPRINT_MATCH', 'FINGERPRINT_NO_MATCH',
      'FACE_SCAN', 'FACE_MATCH', 'FACE_NO_MATCH',
      'ID_SCAN', 'OCR_PROCESS',
      // Report actions
      'REPORT_GENERATE', 'REPORT_EXPORT', 'DATA_EXPORT',
      // System actions
      'SYSTEM_ERROR', 'API_ACCESS', 'FILE_UPLOAD', 'FILE_DOWNLOAD',
    ],
  },
  userId: String,
  userName: String,
  targetType: {
    type: String,
    enum: ['person', 'case', 'user', 'report', 'system', 'file'],
  },
  targetId: String,
  targetName: String,
  description: String,
  details: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  deviceInfo: {
    platform: String,
    os: String,
    browser: String,
  },
  location: {
    lat: Number,
    lng: Number,
    address: String,
  },
  status: {
    type: String,
    enum: ['success', 'failure', 'warning'],
    default: 'success',
  },
  errorMessage: String,
  duration: Number, // in milliseconds
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Indexes for efficient querying
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
