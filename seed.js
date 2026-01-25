const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

// Import models
const Person = require("./models/person");
const Case = require("./models/case");
const Report = require("./models/report");
const AuditLog = require("./models/auditLog");

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

async function seedDatabase() {
  try {
    console.log("Starting database seed...\n");

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log("Clearing existing data...");
    await Person.deleteMany({});
    await Case.deleteMany({});
    await Report.deleteMany({});
    await AuditLog.deleteMany({});
    console.log("Existing data cleared.\n");

    // ========== SEED PERSONS ==========
    console.log("Seeding persons...");
    const personsData = [
      {
        personId: "PER-001",
        name: "Rajesh Kumar",
        gender: "male",
        dateOfBirth: new Date(1985, 5, 15),
        aadhaar: "123456789012",
        phone: "+91 9876543210",
        email: "rajesh.kumar@email.com",
        height: 175,
        weight: 72,
        eyeColor: "Brown",
        hairColor: "Black",
        addresses: [{
          type: "current",
          street: "123 MG Road",
          city: "Mumbai",
          state: "Maharashtra",
          country: "India",
          pincode: "400001",
        }],
        isOnWatchlist: true,
        watchlistPriority: "high",
        watchlistReason: "Suspected in bank fraud case",
        watchlistAddedAt: new Date(),
        status: "active",
        verificationStatus: "verified",
        tags: ["fraud", "financial_crime"],
        notes: "Primary suspect in multiple fraud cases",
        createdBy: "admin",
      },
      {
        personId: "PER-002",
        name: "Priya Sharma",
        gender: "female",
        dateOfBirth: new Date(1990, 8, 22),
        aadhaar: "234567890123",
        phone: "+91 9876543211",
        email: "priya.sharma@email.com",
        height: 162,
        weight: 55,
        eyeColor: "Brown",
        hairColor: "Black",
        addresses: [{
          type: "current",
          street: "456 Park Street",
          city: "Delhi",
          state: "Delhi",
          country: "India",
          pincode: "110001",
        }],
        isOnWatchlist: false,
        status: "active",
        verificationStatus: "verified",
        tags: ["witness"],
        notes: "Witness in Case #003",
        createdBy: "admin",
      },
      {
        personId: "PER-003",
        name: "Mohammed Ali",
        gender: "male",
        dateOfBirth: new Date(1978, 2, 10),
        aadhaar: "345678901234",
        phone: "+91 9876543212",
        email: "mohammed.ali@email.com",
        height: 180,
        weight: 85,
        eyeColor: "Black",
        hairColor: "Black",
        addresses: [{
          type: "current",
          street: "789 Brigade Road",
          city: "Bangalore",
          state: "Karnataka",
          country: "India",
          pincode: "560001",
        }],
        isOnWatchlist: true,
        watchlistPriority: "critical",
        watchlistReason: "Wanted for robbery",
        watchlistAddedAt: new Date(),
        activeAlerts: [{
          type: "wanted",
          description: "Wanted for armed robbery",
          issuedAt: new Date(),
          priority: "critical",
        }],
        criminalHistory: [{
          offense: "Armed Robbery",
          offenseType: "felony",
          dateOccurred: new Date(2023, 6, 15),
          caseNumber: "CR-2023-001",
          verdict: "pending",
          status: "active",
        }],
        status: "active",
        verificationStatus: "verified",
        tags: ["dangerous", "armed"],
        notes: "Considered armed and dangerous",
        createdBy: "admin",
      },
      {
        personId: "PER-004",
        name: "Anita Desai",
        gender: "female",
        dateOfBirth: new Date(1995, 11, 5),
        aadhaar: "456789012345",
        phone: "+91 9876543213",
        email: "anita.desai@email.com",
        height: 158,
        weight: 52,
        eyeColor: "Brown",
        hairColor: "Brown",
        addresses: [{
          type: "current",
          street: "321 Anna Salai",
          city: "Chennai",
          state: "Tamil Nadu",
          country: "India",
          pincode: "600001",
        }],
        isOnWatchlist: false,
        status: "active",
        verificationStatus: "partially_verified",
        tags: ["informant"],
        notes: "Reliable informant",
        createdBy: "admin",
      },
      {
        personId: "PER-005",
        name: "Vikram Singh",
        gender: "male",
        dateOfBirth: new Date(1982, 7, 18),
        aadhaar: "567890123456",
        phone: "+91 9876543214",
        email: "vikram.singh@email.com",
        height: 178,
        weight: 80,
        eyeColor: "Brown",
        hairColor: "Gray",
        addresses: [{
          type: "current",
          street: "567 Jubilee Hills",
          city: "Hyderabad",
          state: "Telangana",
          country: "India",
          pincode: "500033",
        }],
        isOnWatchlist: true,
        watchlistPriority: "medium",
        watchlistReason: "Person of interest in smuggling case",
        watchlistAddedAt: new Date(),
        status: "active",
        verificationStatus: "verified",
        tags: ["smuggling", "investigation"],
        notes: "Under surveillance",
        createdBy: "admin",
      },
    ];

    const persons = await Person.insertMany(personsData);
    console.log(`✓ Seeded ${persons.length} persons`);

    // ========== SEED CASES ==========
    console.log("Seeding cases...");
    const casesData = [
      {
        caseNumber: "CASE-2024-00001",
        title: "Bank Fraud Investigation",
        description: "Investigation into fraudulent transactions at State Bank branch",
        type: "criminal",
        status: "in_progress",
        priority: "high",
        assignedOfficers: [{
          odviserId: "OFF-101",
          name: "Inspector Sharma",
          role: "lead",
        }],
        suspects: [{
          personId: persons[0]._id.toString(),
          name: persons[0].name,
          role: "suspect",
          notes: "Primary suspect",
        }],
        location: {
          address: "State Bank, MG Road",
          city: "Mumbai",
          state: "Maharashtra",
        },
        dateOccurred: new Date(2024, 3, 15),
        dateReported: new Date(2024, 3, 16),
        evidence: [{
          type: "document",
          description: "Bank statements showing fraudulent transactions",
        }],
        timeline: [{
          action: "Case Opened",
          description: "Initial complaint filed",
          performedBy: "Inspector Sharma",
        }],
        notes: [{
          content: "Suspect identified through CCTV footage",
          createdBy: "Inspector Sharma",
        }],
        tags: ["fraud", "financial"],
        createdBy: "admin",
      },
      {
        caseNumber: "CASE-2024-00002",
        title: "Armed Robbery - Jewelry Store",
        description: "Armed robbery at premium jewelry store",
        type: "criminal",
        status: "open",
        priority: "critical",
        assignedOfficers: [{
          odviserId: "OFF-102",
          name: "Inspector Patel",
          role: "lead",
        }],
        suspects: [{
          personId: persons[2]._id.toString(),
          name: persons[2].name,
          role: "suspect",
          notes: "Identified from CCTV",
        }],
        location: {
          address: "Diamond Plaza",
          city: "Bangalore",
          state: "Karnataka",
        },
        dateOccurred: new Date(2024, 5, 20),
        dateReported: new Date(2024, 5, 20),
        evidence: [{
          type: "video",
          description: "CCTV footage of robbery",
        }, {
          type: "fingerprint",
          description: "Fingerprint recovered from counter",
        }],
        timeline: [{
          action: "Case Opened",
          description: "Emergency call received",
          performedBy: "Control Room",
        }, {
          action: "Evidence Collected",
          description: "CSI team collected fingerprints and footage",
          performedBy: "CSI Team",
        }],
        notes: [{
          content: "Suspect is armed and dangerous",
          createdBy: "Inspector Patel",
        }],
        tags: ["robbery", "armed", "urgent"],
        createdBy: "admin",
      },
      {
        caseNumber: "CASE-2024-00003",
        title: "Missing Person - Student",
        description: "College student reported missing by family",
        type: "missing_person",
        status: "in_progress",
        priority: "high",
        assignedOfficers: [{
          odviserId: "OFF-103",
          name: "Sub-Inspector Reddy",
          role: "lead",
        }],
        suspects: [],
        location: {
          address: "IIT Campus",
          city: "Chennai",
          state: "Tamil Nadu",
        },
        dateOccurred: new Date(2024, 7, 10),
        dateReported: new Date(2024, 7, 12),
        evidence: [{
          type: "photo",
          description: "Recent photos of missing person",
        }],
        timeline: [{
          action: "Case Opened",
          description: "Missing person complaint filed by parents",
          performedBy: "Sub-Inspector Reddy",
        }],
        notes: [{
          content: "Last seen near college library",
          createdBy: "Sub-Inspector Reddy",
        }],
        tags: ["missing", "student", "urgent"],
        createdBy: "admin",
      },
      {
        caseNumber: "CASE-2024-00004",
        title: "Smuggling Investigation",
        description: "Investigation into illegal goods smuggling network",
        type: "investigation",
        status: "pending",
        priority: "medium",
        assignedOfficers: [{
          odviserId: "OFF-104",
          name: "Inspector Kumar",
          role: "lead",
        }],
        suspects: [{
          personId: persons[4]._id.toString(),
          name: persons[4].name,
          role: "person_of_interest",
          notes: "Under surveillance",
        }],
        location: {
          address: "Port Area",
          city: "Hyderabad",
          state: "Telangana",
        },
        dateOccurred: new Date(2024, 1, 5),
        dateReported: new Date(2024, 2, 1),
        evidence: [{
          type: "document",
          description: "Shipping manifests with discrepancies",
        }],
        timeline: [{
          action: "Case Opened",
          description: "Intelligence report received",
          performedBy: "Intelligence Bureau",
        }],
        notes: [{
          content: "Ongoing surveillance operation",
          createdBy: "Inspector Kumar",
        }],
        tags: ["smuggling", "organized_crime"],
        createdBy: "admin",
      },
      {
        caseNumber: "CASE-2023-00015",
        title: "Vehicle Theft Ring",
        description: "Investigation into organized vehicle theft operation",
        type: "criminal",
        status: "closed",
        priority: "medium",
        assignedOfficers: [{
          odviserId: "OFF-105",
          name: "Inspector Singh",
          role: "lead",
        }],
        suspects: [],
        location: {
          address: "Multiple locations",
          city: "Delhi",
          state: "Delhi",
        },
        dateOccurred: new Date(2023, 9, 1),
        dateReported: new Date(2023, 9, 5),
        dateClosed: new Date(2024, 1, 15),
        evidence: [{
          type: "document",
          description: "Recovered vehicle documents",
        }],
        timeline: [{
          action: "Case Opened",
          description: "Multiple vehicle theft complaints",
          performedBy: "Inspector Singh",
        }, {
          action: "Case Closed",
          description: "All suspects arrested, vehicles recovered",
          performedBy: "Inspector Singh",
        }],
        notes: [{
          content: "All 5 suspects arrested and vehicles recovered",
          createdBy: "Inspector Singh",
        }],
        tags: ["theft", "vehicles", "solved"],
        createdBy: "admin",
      },
    ];

    const cases = await Case.insertMany(casesData);
    console.log(`✓ Seeded ${cases.length} cases`);

    // ========== SEED REPORTS ==========
    console.log("Seeding reports...");
    const reportsData = [
      {
        reportId: "RPT-001",
        title: "Monthly Analytics Report - November 2024",
        type: "analytics",
        format: "pdf",
        status: "completed",
        generatedBy: "admin",
        generatedAt: new Date(2024, 10, 30),
        parameters: { month: "November", year: 2024 },
        data: { totalCases: 45, closedCases: 12, newPersons: 89 },
      },
      {
        reportId: "RPT-002",
        title: "Watchlist Report - Q4 2024",
        type: "watchlist_report",
        format: "csv",
        status: "completed",
        generatedBy: "admin",
        generatedAt: new Date(2024, 11, 1),
        parameters: { quarter: "Q4", year: 2024 },
        data: { totalOnWatchlist: 23, highPriority: 5, critical: 2 },
      },
      {
        reportId: "RPT-003",
        title: "Case Summary - Bank Fraud",
        type: "case_summary",
        format: "pdf",
        status: "completed",
        generatedBy: "Inspector Sharma",
        generatedAt: new Date(2024, 11, 5),
        parameters: { caseNumber: "CASE-2024-00001" },
        data: { suspects: 1, evidence: 5, timeline_entries: 12 },
      },
      {
        reportId: "RPT-004",
        title: "Audit Report - December 2024",
        type: "audit_report",
        format: "excel",
        status: "completed",
        generatedBy: "system",
        generatedAt: new Date(2024, 11, 10),
        parameters: { month: "December", year: 2024 },
        data: { totalActions: 234, logins: 89, dataAccess: 145 },
      },
      {
        reportId: "RPT-005",
        title: "Activity Report - Week 50",
        type: "activity_report",
        format: "pdf",
        status: "completed",
        generatedBy: "admin",
        generatedAt: new Date(2024, 11, 15),
        parameters: { week: 50, year: 2024 },
        data: { scans: 67, matches: 12, newRecords: 34 },
      },
    ];

    const reports = await Report.insertMany(reportsData);
    console.log(`✓ Seeded ${reports.length} reports`);

    // ========== SEED AUDIT LOGS ==========
    console.log("Seeding audit logs...");
    const auditLogsData = [
      {
        userId: "admin",
        userName: "Administrator",
        action: "LOGIN",
        targetType: "system",
        description: "User logged in",
        ipAddress: "192.168.1.100",
        userAgent: "Biofugitive Mobile App",
        timestamp: new Date(Date.now() - 3600000),
      },
      {
        userId: "OFF-101",
        userName: "Inspector Sharma",
        action: "CASE_CREATE",
        targetType: "case",
        targetId: cases[0]._id.toString(),
        targetName: cases[0].title,
        description: "Created new case",
        ipAddress: "192.168.1.101",
        userAgent: "Biofugitive Mobile App",
        timestamp: new Date(Date.now() - 7200000),
      },
      {
        userId: "OFF-102",
        userName: "Inspector Patel",
        action: "FINGERPRINT_SCAN",
        targetType: "person",
        targetId: persons[2]._id.toString(),
        targetName: persons[2].name,
        description: "Fingerprint scan performed - Match found",
        ipAddress: "192.168.1.102",
        userAgent: "Biofugitive Mobile App",
        timestamp: new Date(Date.now() - 10800000),
      },
      {
        userId: "admin",
        userName: "Administrator",
        action: "WATCHLIST_ADD",
        targetType: "person",
        targetId: persons[0]._id.toString(),
        targetName: persons[0].name,
        description: "Added to watchlist",
        ipAddress: "192.168.1.100",
        userAgent: "Biofugitive Web Portal",
        timestamp: new Date(Date.now() - 14400000),
      },
      {
        userId: "OFF-103",
        userName: "Sub-Inspector Reddy",
        action: "PERSON_CREATE",
        targetType: "person",
        targetId: persons[3]._id.toString(),
        targetName: persons[3].name,
        description: "New person record created",
        ipAddress: "192.168.1.103",
        userAgent: "Biofugitive Mobile App",
        timestamp: new Date(Date.now() - 18000000),
      },
      {
        userId: "admin",
        userName: "Administrator",
        action: "REPORT_GENERATE",
        targetType: "report",
        targetId: reports[0]._id.toString(),
        targetName: reports[0].title,
        description: "Generated analytics report",
        ipAddress: "192.168.1.100",
        userAgent: "Biofugitive Web Portal",
        timestamp: new Date(Date.now() - 21600000),
      },
      {
        userId: "OFF-104",
        userName: "Inspector Kumar",
        action: "CASE_UPDATE",
        targetType: "case",
        targetId: cases[3]._id.toString(),
        targetName: cases[3].title,
        description: "Updated case status",
        ipAddress: "192.168.1.104",
        userAgent: "Biofugitive Mobile App",
        timestamp: new Date(Date.now() - 25200000),
      },
      {
        userId: "OFF-101",
        userName: "Inspector Sharma",
        action: "FACE_MATCH",
        targetType: "person",
        targetId: persons[0]._id.toString(),
        targetName: persons[0].name,
        description: "Face match performed - 92% confidence",
        ipAddress: "192.168.1.101",
        userAgent: "Biofugitive Mobile App",
        timestamp: new Date(Date.now() - 28800000),
      },
    ];

    const auditLogs = await AuditLog.insertMany(auditLogsData);
    console.log(`✓ Seeded ${auditLogs.length} audit logs`);

    console.log("\n========================================");
    console.log("✅ Database seeded successfully!");
    console.log("========================================");
    console.log(`   Persons: ${persons.length}`);
    console.log(`   Cases: ${cases.length}`);
    console.log(`   Reports: ${reports.length}`);
    console.log(`   Audit Logs: ${auditLogs.length}`);
    console.log("========================================\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error seeding database:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the seed function
seedDatabase();
