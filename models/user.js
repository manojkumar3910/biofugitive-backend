const mongoose = require("mongoose");

// Role-based access control permissions
const ROLES = {
  admin: 'admin',       // Everything - Full system access
  officer: 'officer',   // Assigned cases only
  forensic: 'forensic', // Evidence only
  analyst: 'analyst',   // Read-only access
};

// Define permissions for each role
const ROLE_PERMISSIONS = {
  admin: {
    cases: ['create', 'read', 'update', 'delete', 'assign'],
    evidence: ['create', 'read', 'update', 'delete'],
    persons: ['create', 'read', 'update', 'delete'],
    reports: ['create', 'read', 'update', 'delete'],
    users: ['create', 'read', 'update', 'delete'],
    analytics: ['read'],
    auditLogs: ['read'],
    settings: ['read', 'update'],
  },
  officer: {
    cases: ['read', 'update'], // Only assigned cases (checked in middleware)
    evidence: ['read'],
    persons: ['read'],
    reports: ['create', 'read'],
    users: [],
    analytics: ['read'],
    auditLogs: [],
    settings: [],
  },
  forensic: {
    cases: ['read'], // Read case info for context
    evidence: ['create', 'read', 'update', 'delete'],
    persons: ['read'],
    reports: ['create', 'read'],
    users: [],
    analytics: ['read'],
    auditLogs: [],
    settings: [],
  },
  analyst: {
    cases: ['read'],
    evidence: ['read'],
    persons: ['read'],
    reports: ['read'],
    users: [],
    analytics: ['read'],
    auditLogs: ['read'],
    settings: [],
  },
};

const userSchema = new mongoose.Schema({
  user_id: { type: String, required: true, unique: true },
  password: { type: mongoose.Schema.Types.Mixed, required: true }, // Accept both string and number
  email: { type: String, default: null },
  name: { type: String, default: null },
  role: { 
    type: String, 
    enum: Object.values(ROLES),
    default: ROLES.analyst, // Default to most restrictive role
  },
  assignedCases: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Case' }], // For officers
  department: { type: String, default: null },
  badge: { type: String, default: null },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Check if user has permission for a resource and action
userSchema.methods.hasPermission = function(resource, action) {
  const permissions = ROLE_PERMISSIONS[this.role];
  if (!permissions) return false;
  
  const resourcePermissions = permissions[resource];
  if (!resourcePermissions) return false;
  
  return resourcePermissions.includes(action);
};

// Check if user can access a specific case (for officers)
userSchema.methods.canAccessCase = function(caseId) {
  if (this.role === ROLES.admin) return true;
  if (this.role === ROLES.analyst || this.role === ROLES.forensic) return true; // Read-only access
  if (this.role === ROLES.officer) {
    return this.assignedCases.some(id => id.toString() === caseId.toString());
  }
  return false;
};

// Update timestamp on save
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const User = mongoose.model("User", userSchema, "login"); // 'login' is collection name

module.exports = User;
module.exports.ROLES = ROLES;
module.exports.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
