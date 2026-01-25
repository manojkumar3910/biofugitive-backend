const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['permanent', 'current', 'work', 'other'],
    default: 'current',
  },
  street: String,
  city: String,
  state: String,
  pincode: String,
  country: {
    type: String,
    default: 'India',
  },
  coordinates: {
    lat: Number,
    lng: Number,
  },
  verifiedAt: Date,
  isActive: {
    type: Boolean,
    default: true,
  },
});

const photoSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  type: {
    type: String,
    enum: ['mugshot', 'surveillance', 'id_photo', 'candid', 'other'],
    default: 'other',
  },
  description: String,
  takenAt: Date,
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  uploadedBy: String,
  faceEncoding: [Number], // For face recognition
  metadata: mongoose.Schema.Types.Mixed,
});

const fingerprintSchema = new mongoose.Schema({
  hand: {
    type: String,
    enum: ['left', 'right'],
  },
  finger: {
    type: String,
    enum: ['thumb', 'index', 'middle', 'ring', 'little'],
  },
  filename: String,
  quality: Number,
  capturedAt: Date,
  capturedBy: String,
});

const criminalRecordSchema = new mongoose.Schema({
  offense: {
    type: String,
    required: true,
  },
  offenseType: {
    type: String,
    enum: ['felony', 'misdemeanor', 'infraction', 'violation', 'other'],
  },
  description: String,
  dateOccurred: Date,
  dateArrested: Date,
  arrestingAgency: String,
  caseNumber: String,
  courtName: String,
  verdict: {
    type: String,
    enum: ['guilty', 'not_guilty', 'pending', 'dismissed', 'acquitted', 'plea_bargain'],
  },
  sentence: String,
  sentenceStartDate: Date,
  sentenceEndDate: Date,
  status: {
    type: String,
    enum: ['active', 'served', 'on_parole', 'on_probation', 'warrant_active', 'closed'],
    default: 'active',
  },
  notes: String,
});

const associateSchema = new mongoose.Schema({
  personId: mongoose.Schema.Types.ObjectId,
  name: String,
  relationship: {
    type: String,
    enum: ['family', 'friend', 'business', 'criminal', 'romantic', 'other'],
  },
  description: String,
  isActive: {
    type: Boolean,
    default: true,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const locationHistorySchema = new mongoose.Schema({
  address: String,
  city: String,
  state: String,
  coordinates: {
    lat: Number,
    lng: Number,
  },
  sightedAt: Date,
  reportedBy: String,
  source: {
    type: String,
    enum: ['officer', 'surveillance', 'informant', 'public_tip', 'other'],
  },
  confidence: {
    type: String,
    enum: ['low', 'medium', 'high', 'confirmed'],
  },
  notes: String,
});

const personSchema = new mongoose.Schema({
  // Basic Info
  personId: {
    type: String,
    unique: true,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  aliases: [String],
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
  },
  dateOfBirth: Date,
  age: Number,
  
  // Identification
  aadhaar: String,
  pan: String,
  passport: String,
  drivingLicense: String,
  voterId: String,
  
  // Contact
  phone: String,
  email: String,
  
  // Physical Description
  height: Number, // in cm
  weight: Number, // in kg
  eyeColor: String,
  hairColor: String,
  complexion: String,
  distinguishingMarks: [String],
  
  // Addresses
  addresses: [addressSchema],
  
  // Photos & Biometrics
  photos: [photoSchema],
  fingerprints: [fingerprintSchema],
  
  // Criminal Information
  criminalHistory: [criminalRecordSchema],
  knownAssociates: [associateSchema],
  locationHistory: [locationHistorySchema],
  
  // Watchlist
  isOnWatchlist: {
    type: Boolean,
    default: false,
  },
  watchlistPriority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
  },
  watchlistReason: String,
  watchlistAddedAt: Date,
  watchlistAddedBy: String,
  
  // Alerts
  activeAlerts: [{
    type: {
      type: String,
      enum: ['arrest_warrant', 'bolo', 'missing', 'wanted', 'surveillance', 'other'],
    },
    description: String,
    issuedBy: String,
    issuedAt: Date,
    expiresAt: Date,
    priority: String,
  }],
  
  // Case Links
  linkedCases: [{
    caseId: mongoose.Schema.Types.ObjectId,
    caseNumber: String,
    role: String,
    addedAt: Date,
  }],
  
  // Metadata
  status: {
    type: String,
    enum: ['active', 'deceased', 'incarcerated', 'deported', 'unknown'],
    default: 'active',
  },
  verificationStatus: {
    type: String,
    enum: ['unverified', 'partially_verified', 'verified'],
    default: 'unverified',
  },
  source: String,
  tags: [String],
  notes: String,
  
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

// Auto-generate person ID
personSchema.pre('save', async function(next) {
  if (this.isNew && !this.personId) {
    const count = await this.constructor.countDocuments();
    this.personId = `PER-${String(count + 1).padStart(6, '0')}`;
  }
  this.updatedAt = new Date();
  next();
});

// Calculate age from DOB
personSchema.pre('save', function(next) {
  if (this.dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    this.age = age;
  }
  next();
});

module.exports = mongoose.model("Person", personSchema);
