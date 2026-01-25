const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");
const { execSync, spawn } = require("child_process");
const User = require("./models/user");
const { ROLES } = require("./models/user");
const Main = require("./models/main");
const Case = require("./models/case");
const Person = require("./models/person");
const AuditLog = require("./models/auditLog");
const Report = require("./models/report");
const { 
  authenticate, 
  optionalAuth,
  requireRole, 
  requirePermission,
  requireCaseAccess,
  generateToken,
  adminOnly,
  adminOrOfficer,
  adminOrForensic,
  readOnly
} = require("./middleware/auth");

dotenv.config();

// CSV file path
const CSV_PATH = path.join(__dirname, "../biofugitive-app-frontend/public/person_dataset.csv");

// Fingerprint matching configuration
const FINGERPRINT_DB_DIR = path.join(__dirname, "../../new/fingerprints/db");
const FINGERPRINT_JAR = path.join(__dirname, "../../new/project-root/target/fingerprint-matcher-1.0-SNAPSHOT.jar");
const TEMP_DIR = path.join(__dirname, "temp");

// Face recognition configuration (DeepFace)
const FACE_RECOGNITION_SCRIPT = path.join(__dirname, "face_recognition/recognizer.py");
const FACE_DB_DIR = path.join(__dirname, "face_recognition/db");

// Create temp directory if it doesn't exist
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

// Signup Route
app.post("/signup", async (req, res) => {
  const { user_id, password, email, name, role, department, badge } = req.body;

  // Validate required fields
  if (!user_id || !password) {
    return res.status(400).json({ message: "User ID and password are required" });
  }

  // Validate role if provided
  const validRoles = Object.values(ROLES);
  const userRole = role && validRoles.includes(role) ? role : ROLES.analyst;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ user_id });
    if (existingUser) {
      return res.status(409).json({ message: "User ID already exists" });
    }

    // Create new user
    const newUser = new User({
      user_id,
      password,
      email: email || null,
      name: name || null,
      role: userRole,
      department: department || null,
      badge: badge || null,
    });

    await newUser.save();
    console.log("New user created:", user_id, "with role:", userRole);

    // Generate JWT token
    const token = generateToken(newUser);

    res.status(201).json({ 
      message: "Signup successful",
      token,
      user: {
        user_id: newUser.user_id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        badge: newUser.badge,
      }
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Login Route
app.post("/login", async (req, res) => {
  const { user_id, password } = req.body;
  
  console.log("Login attempt:", { user_id, password, passwordType: typeof password });

  try {
    // Try to find user by user_id first
    const user = await User.findOne({ user_id });
    
    if (!user) {
      console.log("User not found");
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    // Compare passwords (handle both string and number comparisons)
    const storedPassword = String(user.password);
    const inputPassword = String(password);
    
    console.log("Comparing passwords:", { stored: storedPassword, input: inputPassword });

    if (storedPassword === inputPassword) {
      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate JWT token
      const token = generateToken(user);

      console.log("Login successful for:", user_id, "role:", user.role);
      res.status(200).json({ 
        message: "Login successful",
        token,
        user: {
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          badge: user.badge,
          assignedCases: user.assignedCases,
        }
      });
    } else {
      console.log("Password mismatch");
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get current user profile
app.get("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ user_id: req.userId }).select('-password');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all users (Admin only)
app.get("/users", authenticate, requireRole(ROLES.admin), async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update user role (Admin only)
app.put("/users/:id/role", authenticate, requireRole(ROLES.admin), async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = Object.values(ROLES);
    
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role", validRoles });
    }

    const user = await User.findOneAndUpdate(
      { user_id: req.params.id },
      { role, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "Role updated", user });
  } catch (err) {
    console.error("Error updating user role:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Assign case to officer (Admin only)
app.post("/users/:id/assign-case", authenticate, requireRole(ROLES.admin), async (req, res) => {
  try {
    const { caseId } = req.body;
    
    if (!caseId) {
      return res.status(400).json({ message: "Case ID is required" });
    }

    const user = await User.findOne({ user_id: req.params.id });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== ROLES.officer) {
      return res.status(400).json({ message: "Can only assign cases to officers" });
    }

    // Add case if not already assigned
    if (!user.assignedCases.includes(caseId)) {
      user.assignedCases.push(caseId);
      await user.save();
    }

    res.status(200).json({ message: "Case assigned", assignedCases: user.assignedCases });
  } catch (err) {
    console.error("Error assigning case:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Deactivate user (Admin only)
app.put("/users/:id/deactivate", authenticate, requireRole(ROLES.admin), async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { user_id: req.params.id },
      { isActive: false, updatedAt: new Date() },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deactivated", user });
  } catch (err) {
    console.error("Error deactivating user:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all documents from main collection
app.get("/documents", async (req, res) => {
  try {
    const documents = await Main.find({});
    res.status(200).json(documents);
  } catch (err) {
    console.error("Error fetching documents:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Parse and cache persons from CSV
let personsCache = null;

const loadPersonsFromCSV = () => {
  return new Promise((resolve, reject) => {
    if (personsCache) {
      return resolve(personsCache);
    }

    try {
      const csvContent = fs.readFileSync(CSV_PATH, "utf8");
      const result = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
      });

      // Group by Person ID
      const grouped = {};
      result.data.forEach((row) => {
        const personId = row["Person ID"];
        if (!personId) return;

        if (!grouped[personId]) {
          grouped[personId] = {
            personId,
            name: row["Name"],
            gender: row["Gender"],
            age: parseInt(row["Age"]) || 0,
            address: row["Address"],
            aadhaar: row["Aadhaar"],
            fingers: [],
          };
        }

        // Extract filename from path
        const imagePath = row["Image Path"] || "";
        const filename = imagePath.split(/[/\\]/).pop();

        grouped[personId].fingers.push({
          hand: row["Hand"],
          finger: row["Finger"],
          filename,
          imagePath,
        });
      });

      personsCache = Object.values(grouped);
      resolve(personsCache);
    } catch (err) {
      reject(err);
    }
  });
};

// Get all persons from CSV
app.get("/persons", async (req, res) => {
  try {
    const persons = await loadPersonsFromCSV();
    
    // Search/filter support
    const { search, gender, city } = req.query;
    let filtered = persons;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name?.toLowerCase().includes(searchLower) ||
          p.personId?.toString().includes(searchLower) ||
          p.aadhaar?.includes(search)
      );
    }

    if (gender) {
      filtered = filtered.filter(
        (p) => p.gender?.toLowerCase() === gender.toLowerCase()
      );
    }

    if (city) {
      filtered = filtered.filter(
        (p) => p.address?.toLowerCase().includes(city.toLowerCase())
      );
    }

    res.status(200).json({
      total: filtered.length,
      persons: filtered,
    });
  } catch (err) {
    console.error("Error fetching persons:", err);
    res.status(500).json({ message: "Error loading person data" });
  }
});

// Get single person by ID
app.get("/persons/:id", async (req, res) => {
  try {
    const persons = await loadPersonsFromCSV();
    const person = persons.find((p) => p.personId === req.params.id);
    
    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }
    
    res.status(200).json(person);
  } catch (err) {
    console.error("Error fetching person:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get dashboard stats
app.get("/stats", async (req, res) => {
  try {
    const persons = await loadPersonsFromCSV();
    
    // Calculate total fingerprints
    const totalFingerprints = persons.reduce((acc, p) => acc + (p.fingers?.length || 0), 0);
    
    // Gender breakdown
    const maleCount = persons.filter(p => p.gender?.toLowerCase() === 'male').length;
    const femaleCount = persons.filter(p => p.gender?.toLowerCase() === 'female').length;
    
    res.status(200).json({
      totalRecords: persons.length,
      totalFingerprints,
      maleCount,
      femaleCount,
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ message: "Error loading stats" });
  }
});

// Fingerprint matching endpoint using Java SourceAFIS algorithm
const MATCH_THRESHOLD = 40;

// Function to run fingerprint matching using Java JAR
const runFingerprintMatcher = (inputPath, dbPath) => {
  return new Promise((resolve, reject) => {
    try {
      // Run the Java JAR with input file and database folder
      const result = execSync(`java -jar "${FINGERPRINT_JAR}" "${inputPath}" "${dbPath}"`, {
        encoding: 'utf-8',
        timeout: 60000, // 60 second timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for output
      });
      
      resolve(result);
    } catch (error) {
      if (error.stdout) {
        resolve(error.stdout);
      } else {
        reject(error);
      }
    }
  });
};

// Parse Java output to extract match results
const parseMatchResults = (output) => {
  const results = [];
  const lines = output.split('\n');
  
  let inResultsTable = false;
  for (const line of lines) {
    // Detect when we're in the results table
    if (line.includes('File Name') && line.includes('Score') && line.includes('Status')) {
      inResultsTable = true;
      continue;
    }
    
    // Skip separator lines
    if (line.startsWith('-') || line.startsWith('=') || line.trim() === '') {
      if (line.startsWith('=') && inResultsTable) {
        inResultsTable = false;
      }
      continue;
    }
    
    // Parse result lines (format: "filename | score | status")
    if (inResultsTable && line.includes('|')) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 3) {
        const fileName = parts[0];
        const score = parseFloat(parts[1]) || 0;
        const isMatch = parts[2].toUpperCase().includes('MATCH') && !parts[2].toUpperCase().includes('NO MATCH');
        
        results.push({
          fileName,
          score,
          isMatch
        });
      }
    }
  }
  
  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results;
};

// Extract best match info from output
const extractBestMatch = (output) => {
  const bestMatchRegex = /Best Match:\s*(\S+)\s*\(Score:\s*([\d.]+)\)/;
  const match = output.match(bestMatchRegex);
  if (match) {
    return {
      fileName: match[1],
      score: parseFloat(match[2])
    };
  }
  return null;
};

app.post("/fingerprint-match", async (req, res) => {
  let tempFilePath = null;
  
  try {
    const { fingerprint, filename } = req.body;

    if (!fingerprint) {
      return res.status(400).json({ message: "No fingerprint data provided" });
    }

    console.log("Received fingerprint for matching:", filename);

    // Check if Java JAR exists
    if (!fs.existsSync(FINGERPRINT_JAR)) {
      console.error("Fingerprint matcher JAR not found at:", FINGERPRINT_JAR);
      return res.status(500).json({ 
        message: "Fingerprint matching service not available. JAR file not found.",
        path: FINGERPRINT_JAR
      });
    }

    // Check if database folder exists
    if (!fs.existsSync(FINGERPRINT_DB_DIR)) {
      console.error("Fingerprint database folder not found at:", FINGERPRINT_DB_DIR);
      return res.status(500).json({ 
        message: "Fingerprint database not found.",
        path: FINGERPRINT_DB_DIR
      });
    }

    // Convert base64 to buffer and save to temp file
    const uploadedFingerprintBuffer = Buffer.from(fingerprint, 'base64');
    tempFilePath = path.join(TEMP_DIR, `upload_${Date.now()}.bmp`);
    fs.writeFileSync(tempFilePath, uploadedFingerprintBuffer);

    console.log("Saved uploaded fingerprint to:", tempFilePath);
    console.log("Using database folder:", FINGERPRINT_DB_DIR);

    // Run the Java fingerprint matcher
    console.log("Running fingerprint matcher...");
    const output = await runFingerprintMatcher(tempFilePath, FINGERPRINT_DB_DIR);
    
    console.log("Matcher output:", output);

    // Parse the results
    const matchResults = parseMatchResults(output);
    const bestMatch = extractBestMatch(output);

    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    // Find matches above threshold
    const matches = matchResults.filter(r => r.isMatch);

    if (matches.length > 0 && bestMatch) {
      console.log(`Match found! File: ${bestMatch.fileName}, Score: ${bestMatch.score}`);
      
      // Try to extract person info from filename (format: PersonID_Hand_Finger.bmp)
      const fileNameParts = bestMatch.fileName.replace(/\.[^/.]+$/, "").split('_');
      let personInfo = null;
      
      if (fileNameParts.length >= 1) {
        // Try to find person in CSV by matching filename pattern
        const persons = await loadPersonsFromCSV();
        for (const person of persons) {
          for (const finger of person.fingers || []) {
            if (finger.filename === bestMatch.fileName) {
              personInfo = {
                personId: person.personId,
                name: person.name,
                gender: person.gender,
                age: person.age,
                address: person.address,
                aadhaar: person.aadhaar,
                matchedFinger: {
                  hand: finger.hand,
                  finger: finger.finger,
                }
              };
              break;
            }
          }
          if (personInfo) break;
        }
      }

      res.status(200).json({
        matchFound: true,
        score: bestMatch.score,
        totalChecked: matchResults.length,
        matchedFile: bestMatch.fileName,
        matchedPerson: personInfo,
        allMatches: matches.slice(0, 5), // Return top 5 matches
      });
    } else {
      const bestScore = matchResults.length > 0 ? matchResults[0].score : 0;
      console.log(`No match found. Best score: ${bestScore}, Total checked: ${matchResults.length}`);
      
      res.status(200).json({
        matchFound: false,
        bestScore: bestScore,
        totalChecked: matchResults.length,
        message: "No matching fingerprint found in database",
      });
    }
  } catch (error) {
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        console.error("Error cleaning up temp file:", e);
      }
    }
    
    console.error("Fingerprint matching error:", error);
    res.status(500).json({ 
      message: "Error processing fingerprint",
      error: error.message 
    });
  }
});

// Serve fingerprint images from database
app.get("/fingerprints/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(FINGERPRINT_DB_DIR, filename);

  // Security check - prevent directory traversal
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return res.status(400).json({ message: "Invalid filename" });
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "Image not found", requested: filename });
  }
  
  // Determine content type based on extension
  const ext = path.extname(filename).toLowerCase();
  const contentTypes = {
    '.bmp': 'image/bmp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };
  
  res.setHeader("Content-Type", contentTypes[ext] || "image/bmp");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.sendFile(filePath);
});

// ============================================
// AUDIT LOGGING HELPER
// ============================================
const logAudit = async (action, userId, userName, targetType, targetId, targetName, description, details = {}, status = 'success') => {
  try {
    await AuditLog.create({
      action,
      userId,
      userName,
      targetType,
      targetId,
      targetName,
      description,
      details,
      status,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
};

// ============================================
// CASE MANAGEMENT APIs
// ============================================

// Get all cases with filtering
app.get("/cases", async (req, res) => {
  try {
    const { status, priority, assignedTo, search, limit = 50, skip = 0 } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter['assignedOfficers.odviserId'] = assignedTo;
    if (search) {
      filter.$or = [
        { caseNumber: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const cases = await Case.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));
    
    const total = await Case.countDocuments(filter);

    res.status(200).json({ total, cases });
  } catch (err) {
    console.error("Error fetching cases:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get single case
app.get("/cases/:id", async (req, res) => {
  try {
    const caseDoc = await Case.findById(req.params.id);
    if (!caseDoc) {
      return res.status(404).json({ message: "Case not found" });
    }
    res.status(200).json(caseDoc);
  } catch (err) {
    console.error("Error fetching case:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Create new case
app.post("/cases", async (req, res) => {
  try {
    const newCase = new Case(req.body);
    newCase.addTimelineEntry('CASE_CREATED', 'Case was created', req.body.createdBy);
    await newCase.save();
    
    await logAudit('CASE_CREATE', req.body.createdBy, req.body.createdBy, 'case', newCase._id, newCase.caseNumber, 'New case created');
    
    res.status(201).json(newCase);
  } catch (err) {
    console.error("Error creating case:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Update case
app.put("/cases/:id", async (req, res) => {
  try {
    const oldCase = await Case.findById(req.params.id);
    if (!oldCase) {
      return res.status(404).json({ message: "Case not found" });
    }

    // Track status change
    if (req.body.status && req.body.status !== oldCase.status) {
      oldCase.addTimelineEntry('STATUS_CHANGED', `Status changed from ${oldCase.status} to ${req.body.status}`, req.body.updatedBy);
      if (req.body.status === 'closed') {
        oldCase.dateClosed = new Date();
      }
    }

    Object.assign(oldCase, req.body);
    await oldCase.save();
    
    await logAudit('CASE_UPDATE', req.body.updatedBy, req.body.updatedBy, 'case', oldCase._id, oldCase.caseNumber, 'Case updated');

    res.status(200).json(oldCase);
  } catch (err) {
    console.error("Error updating case:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete case
app.delete("/cases/:id", async (req, res) => {
  try {
    const deletedCase = await Case.findByIdAndDelete(req.params.id);
    if (!deletedCase) {
      return res.status(404).json({ message: "Case not found" });
    }
    
    await logAudit('CASE_DELETE', req.query.userId, req.query.userId, 'case', deletedCase._id, deletedCase.caseNumber, 'Case deleted');
    
    res.status(200).json({ message: "Case deleted successfully" });
  } catch (err) {
    console.error("Error deleting case:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Add note to case
app.post("/cases/:id/notes", async (req, res) => {
  try {
    const caseDoc = await Case.findById(req.params.id);
    if (!caseDoc) {
      return res.status(404).json({ message: "Case not found" });
    }

    caseDoc.notes.push(req.body);
    caseDoc.addTimelineEntry('NOTE_ADDED', 'Note added to case', req.body.createdBy);
    await caseDoc.save();

    res.status(201).json(caseDoc);
  } catch (err) {
    console.error("Error adding note:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Add suspect to case
app.post("/cases/:id/suspects", async (req, res) => {
  try {
    const caseDoc = await Case.findById(req.params.id);
    if (!caseDoc) {
      return res.status(404).json({ message: "Case not found" });
    }

    caseDoc.suspects.push(req.body);
    caseDoc.addTimelineEntry('SUSPECT_ADDED', `${req.body.name} added as ${req.body.role}`, req.body.addedBy);
    await caseDoc.save();

    res.status(201).json(caseDoc);
  } catch (err) {
    console.error("Error adding suspect:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Assign officer to case
app.post("/cases/:id/assign", async (req, res) => {
  try {
    const caseDoc = await Case.findById(req.params.id);
    if (!caseDoc) {
      return res.status(404).json({ message: "Case not found" });
    }

    caseDoc.assignedOfficers.push(req.body);
    caseDoc.addTimelineEntry('OFFICER_ASSIGNED', `${req.body.name} assigned to case`, req.body.assignedBy);
    await caseDoc.save();
    
    await logAudit('CASE_ASSIGN', req.body.assignedBy, req.body.assignedBy, 'case', caseDoc._id, caseDoc.caseNumber, `Officer ${req.body.name} assigned`);

    res.status(201).json(caseDoc);
  } catch (err) {
    console.error("Error assigning officer:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get case statistics
app.get("/cases-stats", async (req, res) => {
  try {
    const [statusCounts, priorityCounts, typeCounts, recentCases] = await Promise.all([
      Case.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Case.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
      Case.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
      Case.find().sort({ createdAt: -1 }).limit(5).select('caseNumber title status createdAt'),
    ]);

    res.status(200).json({
      byStatus: statusCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      byPriority: priorityCounts.reduce((acc, p) => ({ ...acc, [p._id]: p.count }), {}),
      byType: typeCounts.reduce((acc, t) => ({ ...acc, [t._id]: t.count }), {}),
      total: await Case.countDocuments(),
      recentCases,
    });
  } catch (err) {
    console.error("Error fetching case stats:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================================
// PERSON MANAGEMENT APIs (MongoDB)
// ============================================

// Get all persons from MongoDB
app.get("/persons-db", async (req, res) => {
  try {
    const { search, gender, watchlist, limit = 50, skip = 0 } = req.query;
    
    const filter = {};
    if (gender) filter.gender = gender.toLowerCase();
    if (watchlist === 'true') filter.isOnWatchlist = true;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { personId: { $regex: search, $options: 'i' } },
        { aadhaar: { $regex: search, $options: 'i' } },
        { aliases: { $regex: search, $options: 'i' } },
      ];
    }

    const persons = await Person.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));
    
    const total = await Person.countDocuments(filter);

    res.status(200).json({ total, persons });
  } catch (err) {
    console.error("Error fetching persons:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get single person from MongoDB
app.get("/persons-db/:id", async (req, res) => {
  try {
    const person = await Person.findById(req.params.id);
    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }
    res.status(200).json(person);
  } catch (err) {
    console.error("Error fetching person:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Create new person
app.post("/persons-db", async (req, res) => {
  try {
    const newPerson = new Person(req.body);
    await newPerson.save();
    
    await logAudit('PERSON_CREATE', req.body.createdBy, req.body.createdBy, 'person', newPerson._id, newPerson.name, 'New person record created');
    
    res.status(201).json(newPerson);
  } catch (err) {
    console.error("Error creating person:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Update person
app.put("/persons-db/:id", async (req, res) => {
  try {
    const person = await Person.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    
    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }
    
    await logAudit('PERSON_UPDATE', req.body.updatedBy, req.body.updatedBy, 'person', person._id, person.name, 'Person record updated');
    
    res.status(200).json(person);
  } catch (err) {
    console.error("Error updating person:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete person
app.delete("/persons-db/:id", async (req, res) => {
  try {
    const person = await Person.findByIdAndDelete(req.params.id);
    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }
    
    await logAudit('PERSON_DELETE', req.query.userId, req.query.userId, 'person', person._id, person.name, 'Person record deleted');
    
    res.status(200).json({ message: "Person deleted successfully" });
  } catch (err) {
    console.error("Error deleting person:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Add criminal record to person
app.post("/persons-db/:id/criminal-history", async (req, res) => {
  try {
    const person = await Person.findById(req.params.id);
    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }

    person.criminalHistory.push(req.body);
    await person.save();

    res.status(201).json(person);
  } catch (err) {
    console.error("Error adding criminal record:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Add known associate
app.post("/persons-db/:id/associates", async (req, res) => {
  try {
    const person = await Person.findById(req.params.id);
    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }

    person.knownAssociates.push(req.body);
    await person.save();

    res.status(201).json(person);
  } catch (err) {
    console.error("Error adding associate:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Add location history
app.post("/persons-db/:id/location", async (req, res) => {
  try {
    const person = await Person.findById(req.params.id);
    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }

    person.locationHistory.push(req.body);
    await person.save();

    res.status(201).json(person);
  } catch (err) {
    console.error("Error adding location:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Toggle watchlist status
app.post("/persons-db/:id/watchlist", async (req, res) => {
  try {
    const person = await Person.findById(req.params.id);
    if (!person) {
      return res.status(404).json({ message: "Person not found" });
    }

    person.isOnWatchlist = !person.isOnWatchlist;
    if (person.isOnWatchlist) {
      person.watchlistPriority = req.body.priority || 'medium';
      person.watchlistReason = req.body.reason;
      person.watchlistAddedAt = new Date();
      person.watchlistAddedBy = req.body.addedBy;
    }
    await person.save();
    
    await logAudit(
      person.isOnWatchlist ? 'WATCHLIST_ADD' : 'WATCHLIST_REMOVE',
      req.body.addedBy, req.body.addedBy,
      'person', person._id, person.name,
      person.isOnWatchlist ? 'Added to watchlist' : 'Removed from watchlist'
    );

    res.status(200).json(person);
  } catch (err) {
    console.error("Error updating watchlist:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get watchlist
app.get("/watchlist", async (req, res) => {
  try {
    const watchlist = await Person.find({ isOnWatchlist: true })
      .sort({ watchlistPriority: -1, watchlistAddedAt: -1 });
    res.status(200).json(watchlist);
  } catch (err) {
    console.error("Error fetching watchlist:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================================
// ANALYTICS & REPORTING APIs
// ============================================

// Get comprehensive analytics
app.get("/analytics", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    
    const [
      totalPersons,
      totalCases,
      watchlistCount,
      casesByStatus,
      casesByMonth,
      matchesByDay,
      recentMatches,
      topOfficers,
    ] = await Promise.all([
      Person.countDocuments(),
      Case.countDocuments(),
      Person.countDocuments({ isOnWatchlist: true }),
      Case.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Case.aggregate([
        { $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          count: { $sum: 1 }
        }},
        { $sort: { _id: -1 } },
        { $limit: 12 }
      ]),
      AuditLog.aggregate([
        { $match: { action: { $in: ['FINGERPRINT_MATCH', 'FACE_MATCH'] } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 }
        }},
        { $sort: { _id: -1 } },
        { $limit: 30 }
      ]),
      AuditLog.find({ action: { $in: ['FINGERPRINT_MATCH', 'FACE_MATCH'] } })
        .sort({ timestamp: -1 })
        .limit(10),
      AuditLog.aggregate([
        { $group: { _id: '$userName', actions: { $sum: 1 } } },
        { $sort: { actions: -1 } },
        { $limit: 5 }
      ]),
    ]);

    res.status(200).json({
      overview: {
        totalPersons,
        totalCases,
        watchlistCount,
        openCases: casesByStatus.find(s => s._id === 'open')?.count || 0,
        closedCases: casesByStatus.find(s => s._id === 'closed')?.count || 0,
      },
      casesByStatus: casesByStatus.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      casesByMonth: casesByMonth.reverse(),
      matchesByDay,
      recentMatches,
      topOfficers,
    });
  } catch (err) {
    console.error("Error fetching analytics:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get audit logs
app.get("/audit-logs", async (req, res) => {
  try {
    const { action, userId, targetType, startDate, endDate, limit = 100, skip = 0 } = req.query;
    
    const filter = {};
    if (action) filter.action = action;
    if (userId) filter.userId = userId;
    if (targetType) filter.targetType = targetType;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit));
    
    const total = await AuditLog.countDocuments(filter);

    res.status(200).json({ total, logs });
  } catch (err) {
    console.error("Error fetching audit logs:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Generate report
app.post("/reports/generate", async (req, res) => {
  try {
    const { type, title, parameters, generatedBy, format = 'json' } = req.body;
    
    let reportData = {};
    
    switch (type) {
      case 'case_summary':
        if (parameters?.caseId) {
          reportData = await Case.findById(parameters.caseId);
        } else {
          reportData = await Case.find(parameters?.filter || {}).limit(100);
        }
        break;
        
      case 'person_profile':
        if (parameters?.personId) {
          reportData = await Person.findById(parameters.personId);
        }
        break;
        
      case 'watchlist_report':
        reportData = await Person.find({ isOnWatchlist: true });
        break;
        
      case 'analytics':
        const analytics = await Promise.all([
          Person.countDocuments(),
          Case.countDocuments(),
          Person.countDocuments({ isOnWatchlist: true }),
          Case.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        ]);
        reportData = {
          totalPersons: analytics[0],
          totalCases: analytics[1],
          watchlistCount: analytics[2],
          casesByStatus: analytics[3],
        };
        break;
        
      case 'audit_report':
        reportData = await AuditLog.find(parameters?.filter || {})
          .sort({ timestamp: -1 })
          .limit(parameters?.limit || 500);
        break;
        
      default:
        reportData = { message: 'Unknown report type' };
    }

    const report = new Report({
      type,
      title: title || `${type} Report`,
      format,
      parameters,
      data: reportData,
      generatedBy,
      generatedAt: new Date(),
      status: 'completed',
    });
    await report.save();
    
    await logAudit('REPORT_GENERATE', generatedBy, generatedBy, 'report', report._id, report.title, `Generated ${type} report`);

    res.status(201).json(report);
  } catch (err) {
    console.error("Error generating report:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get reports list
app.get("/reports", async (req, res) => {
  try {
    const { type, generatedBy, limit = 50, skip = 0 } = req.query;
    
    const filter = {};
    if (type) filter.type = type;
    if (generatedBy) filter.generatedBy = generatedBy;

    const reports = await Report.find(filter)
      .sort({ generatedAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .select('-data');
    
    const total = await Report.countDocuments(filter);

    res.status(200).json({ total, reports });
  } catch (err) {
    console.error("Error fetching reports:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get single report with data
app.get("/reports/:id", async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }
    
    report.downloadCount += 1;
    await report.save();

    res.status(200).json(report);
  } catch (err) {
    console.error("Error fetching report:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Export data as CSV
app.get("/export/csv/:type", async (req, res) => {
  try {
    const { type } = req.params;
    let data = [];
    let filename = '';

    switch (type) {
      case 'persons':
        data = await Person.find().lean();
        filename = 'persons_export.csv';
        break;
      case 'cases':
        data = await Case.find().lean();
        filename = 'cases_export.csv';
        break;
      case 'watchlist':
        data = await Person.find({ isOnWatchlist: true }).lean();
        filename = 'watchlist_export.csv';
        break;
      case 'audit':
        data = await AuditLog.find().sort({ timestamp: -1 }).limit(1000).lean();
        filename = 'audit_export.csv';
        break;
      default:
        return res.status(400).json({ message: 'Invalid export type' });
    }

    const csv = Papa.unparse(data.map(d => {
      const flat = {};
      Object.keys(d).forEach(key => {
        if (typeof d[key] === 'object' && d[key] !== null && !Array.isArray(d[key])) {
          Object.keys(d[key]).forEach(subKey => {
            flat[`${key}_${subKey}`] = d[key][subKey];
          });
        } else if (Array.isArray(d[key])) {
          flat[key] = d[key].length;
        } else {
          flat[key] = d[key];
        }
      });
      return flat;
    }));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csv);
  } catch (err) {
    console.error("Error exporting data:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ============================================
// FACE RECOGNITION API (DeepFace Integration)
// ============================================

const PHOTOS_DIR = path.join(__dirname, "uploads/photos");
if (!fs.existsSync(PHOTOS_DIR)) {
  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

// Ensure face recognition db directory exists
if (!fs.existsSync(FACE_DB_DIR)) {
  fs.mkdirSync(FACE_DB_DIR, { recursive: true });
}

// Helper function to run DeepFace Python script
const runDeepFaceRecognition = (imagePath, dbPath) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    // Use 'python' command
    const pythonProcess = spawn('python', [FACE_RECOGNITION_SCRIPT, imagePath, dbPath], {
      env: { 
        ...process.env, 
        TF_CPP_MIN_LOG_LEVEL: '3',
        TF_ENABLE_ONEDNN_OPTS: '0',
        PYTHONUNBUFFERED: '1'
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    // Set a timeout for the entire process
    const timeout = setTimeout(() => {
      pythonProcess.kill();
      reject(new Error('DeepFace process timeout after 120 seconds'));
    }, 120000);
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      clearTimeout(timeout);
      const processingTime = Date.now() - startTime;
      
      console.log('Python process exit code:', code);
      console.log('Python stdout length:', stdout.length);
      if (stderr) console.log('Python stderr:', stderr);
      
      // Try to parse stdout - find JSON in output
      if (!stdout.trim()) {
        if (stderr) {
          reject(new Error(`DeepFace error: ${stderr.substring(0, 200)}`));
        } else {
          reject(new Error('DeepFace script produced no output'));
        }
        return;
      }
      
      try {
        // Try to extract JSON from output (in case there's any extra text)
        let jsonStr = stdout.trim();
        
        // Find the first { and last } to extract JSON
        const jsonStart = jsonStr.indexOf('{');
        const jsonEnd = jsonStr.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
        }
        
        const result = JSON.parse(jsonStr);
        result.processingTime = processingTime;
        console.log('DeepFace result parsed successfully');
        resolve(result);
      } catch (parseError) {
        console.error('Failed to parse DeepFace output:', stdout.substring(0, 500));
        console.error('Parse error:', parseError.message);
        reject(new Error(`Invalid JSON from DeepFace. Raw output: ${stdout.substring(0, 100)}`));
      }
    });
    
    pythonProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.error('Failed to start Python process:', error);
      reject(new Error(`Failed to start Python: ${error.message}`));
    });
  });
};

app.post("/face-match", async (req, res) => {
  const startTime = Date.now();
  let tempPath = null;
  
  try {
    const { faceImage, filename } = req.body;

    if (!faceImage) {
      return res.status(400).json({ message: "No face image provided" });
    }

    console.log("Received face image for matching:", filename);
    
    // Save uploaded image to temp directory
    const uploadedBuffer = Buffer.from(faceImage, 'base64');
    tempPath = path.join(TEMP_DIR, `face_${Date.now()}.jpg`);
    fs.writeFileSync(tempPath, uploadedBuffer);
    
    console.log("Saved temp image to:", tempPath);
    console.log("Using face recognition script:", FACE_RECOGNITION_SCRIPT);
    console.log("Using face DB:", FACE_DB_DIR);
    
    // Verify script exists
    if (!fs.existsSync(FACE_RECOGNITION_SCRIPT)) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      return res.status(500).json({
        matchFound: false,
        message: `Face recognition script not found at: ${FACE_RECOGNITION_SCRIPT}`,
        errorType: 'SCRIPT_NOT_FOUND'
      });
    }

    // Check if face database has any images
    const dbFiles = fs.readdirSync(FACE_DB_DIR).filter(f => 
      /\.(jpg|jpeg|png|bmp)$/i.test(f)
    );
    
    if (dbFiles.length === 0) {
      // Clean up temp file
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      return res.status(200).json({
        matchFound: false,
        message: "No reference faces in database. Please add face images to the database first.",
        totalCompared: 0,
        processingTime: Date.now() - startTime,
        databasePath: FACE_DB_DIR
      });
    }

    console.log(`Found ${dbFiles.length} reference face images in database`);

    // Run DeepFace recognition
    let deepfaceResult;
    try {
      deepfaceResult = await runDeepFaceRecognition(tempPath, FACE_DB_DIR);
    } catch (deepfaceError) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      
      console.error("DeepFace execution error:", deepfaceError.message);
      return res.status(500).json({
        matchFound: false,
        message: `Face recognition failed: ${deepfaceError.message}`,
        errorType: 'DEEPFACE_ERROR',
        processingTime: Date.now() - startTime
      });
    }
    
    console.log("DeepFace result:", deepfaceResult);

    // Clean up temp file
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    // Handle errors from DeepFace
    if (deepfaceResult.error) {
      return res.status(200).json({
        matchFound: false,
        message: deepfaceResult.error,
        errorType: deepfaceResult.errorType || 'PROCESSING_ERROR',
        totalCompared: dbFiles.length,
        processingTime: deepfaceResult.processingTime
      });
    }

    // Process successful result
    if (deepfaceResult.match) {
      // Try to find person details from CSV/database based on filename
      let matchedPerson = null;
      const personIdentifier = deepfaceResult.personIdentifier;
      
      // Try to load person from CSV
      try {
        const persons = await loadPersonsFromCSV();
        matchedPerson = persons.find(p => 
          p.personId === personIdentifier || 
          p.name.toLowerCase().includes(personIdentifier.toLowerCase())
        );
      } catch (err) {
        console.log("Could not load person from CSV:", err.message);
      }

      // If not found in CSV, create basic info from filename
      if (!matchedPerson) {
        matchedPerson = {
          personId: personIdentifier,
          name: personIdentifier.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          matchedFile: deepfaceResult.filename
        };
      }

      await logAudit('FACE_MATCH', req.body.userId, matchedPerson.personId, 'person', null, null, 
        `Face match found: ${matchedPerson.name} (confidence: ${deepfaceResult.confidence}%)`);

      return res.status(200).json({
        matchFound: true,
        matchedPerson: matchedPerson,
        confidence: deepfaceResult.confidence,
        distance: deepfaceResult.distance,
        matchedFile: deepfaceResult.filename,
        totalCompared: dbFiles.length,
        processingTime: deepfaceResult.processingTime,
        message: `Match found: ${matchedPerson.name}`
      });
    } else {
      await logAudit('FACE_SCAN', req.body.userId, req.body.userId, 'system', null, null, 'Face scan - no match found');

      return res.status(200).json({
        matchFound: false,
        message: deepfaceResult.message || "No matching person found in database.",
        totalCompared: dbFiles.length,
        processingTime: deepfaceResult.processingTime
      });
    }
  } catch (err) {
    console.error("Face match error:", err);
    
    // Clean up temp file on error
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    
    res.status(500).json({ 
      message: `Face recognition failed: ${err.message}`, 
      error: err.message,
      matchFound: false
    });
  }
});

// ============================================
// ID CARD OCR API
// ============================================

app.post("/ocr/id-card", async (req, res) => {
  try {
    const { image, filename } = req.body;

    if (!image) {
      return res.status(400).json({ message: "No image provided" });
    }

    console.log("Received ID card for OCR:", filename);

    const uploadedBuffer = Buffer.from(image, 'base64');
    const tempPath = path.join(TEMP_DIR, `id_${Date.now()}.jpg`);
    fs.writeFileSync(tempPath, uploadedBuffer);

    // Placeholder - integrate with Tesseract.js or Google Cloud Vision
    const extractedData = {
      success: true,
      message: "OCR processing complete. For production, integrate with Tesseract.js or Google Cloud Vision.",
      extractedFields: {
        documentType: "ID Card",
        name: null,
        dateOfBirth: null,
        gender: null,
        address: null,
        idNumber: null,
      },
      rawText: "",
      confidence: 0,
    };

    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    await logAudit('OCR_PROCESS', req.body.userId, req.body.userId, 'system', null, null, 'ID card OCR performed');

    res.status(200).json(extractedData);
  } catch (err) {
    console.error("OCR error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ============================================
// DASHBOARD EXTENDED STATS
// ============================================

app.get("/dashboard-stats", async (req, res) => {
  try {
    const persons = await loadPersonsFromCSV();
    
    const [
      dbPersonCount,
      caseCount,
      watchlistCount,
      openCases,
      recentAudit,
    ] = await Promise.all([
      Person.countDocuments(),
      Case.countDocuments(),
      Person.countDocuments({ isOnWatchlist: true }),
      Case.countDocuments({ status: 'open' }),
      AuditLog.find().sort({ timestamp: -1 }).limit(10),
    ]);

    const totalFingerprints = persons.reduce((acc, p) => acc + (p.fingers?.length || 0), 0);
    const maleCount = persons.filter(p => p.gender?.toLowerCase() === 'male').length;
    const femaleCount = persons.filter(p => p.gender?.toLowerCase() === 'female').length;

    res.status(200).json({
      csvStats: {
        totalRecords: persons.length,
        totalFingerprints,
        maleCount,
        femaleCount,
      },
      dbStats: {
        totalPersons: dbPersonCount,
        totalCases: caseCount,
        watchlistCount,
        openCases,
      },
      recentActivity: recentAudit,
    });
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =============================================
// SEED DATA ENDPOINT - Populate dummy data
// =============================================
app.post("/seed-data", async (req, res) => {
  try {
    console.log("Seeding database with dummy data...");
    
    // Read CSV to get person data
    const csvData = fs.readFileSync(CSV_PATH, "utf8");
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    const csvPersons = parsed.data.slice(0, 20); // Get first 20 for seeding

    // Seed Persons from CSV
    const personPromises = csvPersons.map(async (p, idx) => {
      const personId = `PER-${Date.now()}-${idx}`;
      const existing = await Person.findOne({ name: p.name });
      if (existing) return existing;

      const genderVal = p.gender?.toLowerCase() === 'female' ? 'female' : 'male';

      return Person.create({
        personId: personId,
        name: p.name || `Person ${idx + 1}`,
        aliases: [],
        gender: genderVal,
        dateOfBirth: new Date(1970 + Math.floor(Math.random() * 40), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        aadhaar: `${Math.floor(Math.random() * 9000000000) + 1000000000}${Math.floor(Math.random() * 100)}`,
        phone: `+91 ${9000000000 + idx * 1000}`,
        email: `person${idx + 1}@example.com`,
        height: 150 + Math.floor(Math.random() * 40),
        weight: 50 + Math.floor(Math.random() * 50),
        eyeColor: ['Brown', 'Black', 'Blue', 'Green'][idx % 4],
        hairColor: ['Black', 'Brown', 'Gray'][idx % 3],
        distinguishingMarks: idx % 3 === 0 ? ['Scar on left arm'] : [],
        addresses: [{
          type: 'current',
          street: `${100 + idx} Main Street`,
          city: ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad'][idx % 5],
          state: ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Telangana'][idx % 5],
          country: 'India',
          pincode: `${500000 + idx * 100}`,
        }],
        isOnWatchlist: idx % 5 === 0,
        watchlistPriority: idx % 5 === 0 ? 'high' : undefined,
        watchlistReason: idx % 5 === 0 ? 'Suspected in theft case' : undefined,
        watchlistAddedAt: idx % 5 === 0 ? new Date() : undefined,
        criminalHistory: idx % 4 === 0 ? [{
          offense: 'Petty theft',
          offenseType: 'misdemeanor',
          dateOccurred: new Date(2020, 5, 15),
          caseNumber: `CR-2020-${idx}`,
          verdict: 'guilty',
          sentence: '6 months probation',
          status: 'served',
        }] : [],
        activeAlerts: idx % 10 === 0 ? [{
          type: 'wanted',
          description: 'Wanted for questioning',
          issuedAt: new Date(),
          priority: 'medium',
        }] : [],
        status: 'active',
        verificationStatus: 'verified',
        tags: ['imported', 'csv'],
        notes: `Imported from CSV database. Record ${idx + 1}.`,
        createdBy: 'system',
      });
    });

    const persons = await Promise.all(personPromises);
    console.log(`Seeded ${persons.length} persons`);

    // Seed Cases
    const caseStatuses = ['open', 'in_progress', 'pending', 'closed', 'archived'];
    const casePriorities = ['critical', 'high', 'medium', 'low'];
    const caseTypes = ['criminal', 'civil', 'investigation', 'surveillance', 'missing_person', 'other'];

    const casePromises = Array(10).fill(null).map(async (_, idx) => {
      const caseNum = `CASE-${Date.now()}-${idx}`;
      const existing = await Case.findOne({ title: `Case #${idx + 1}` });
      if (existing) return existing;

      return Case.create({
        caseNumber: caseNum,
        title: `Case #${idx + 1}: ${caseTypes[idx % caseTypes.length].replace('_', ' ')}`,
        description: `Investigation into ${caseTypes[idx % caseTypes.length].replace('_', ' ')} incident reported on ${new Date(2024, idx % 12, idx + 1).toLocaleDateString()}`,
        type: caseTypes[idx % caseTypes.length],
        status: caseStatuses[idx % caseStatuses.length],
        priority: casePriorities[idx % casePriorities.length],
        assignedOfficers: [{
          odviserId: `OFF-${100 + idx}`,
          name: `Officer ${['Smith', 'Johnson', 'Williams', 'Brown', 'Davis'][idx % 5]}`,
          role: 'lead',
          assignedAt: new Date(),
        }],
        location: {
          address: `${200 + idx} Crime Scene Ave`,
          city: ['Mumbai', 'Delhi', 'Bangalore'][idx % 3],
          state: ['Maharashtra', 'Delhi', 'Karnataka'][idx % 3],
          coordinates: { lat: 19.076 + idx * 0.01, lng: 72.877 + idx * 0.01 },
        },
        dateReported: new Date(2024, idx % 12, idx + 1),
        dateOccurred: new Date(2024, idx % 12, idx),
        suspects: persons.slice(idx % 5, (idx % 5) + 2).map((p, pIdx) => ({
          personId: p._id?.toString(),
          name: p.name,
          role: ['suspect', 'person_of_interest', 'witness', 'victim', 'informant'][pIdx % 5],
          notes: 'Identified during investigation',
        })),
        evidence: [{
          type: 'photo',
          description: 'Crime scene photo',
        }],
        timeline: [{
          action: 'Case opened',
          description: 'Initial report filed',
          performedBy: 'System',
        }],
        notes: [{
          content: 'Initial investigation notes',
          createdBy: 'Officer',
          createdAt: new Date(),
        }],
      });
    });

    const cases = await Promise.all(casePromises);
    console.log(`Seeded ${cases.length} cases`);

    // Seed Reports
    const reportTypes = ['analytics', 'case_summary', 'person_profile', 'watchlist_report', 'activity_report', 'audit_report'];
    const reportPromises = Array(5).fill(null).map(async (_, idx) => {
      return Report.create({
        reportId: `RPT-${Date.now()}-${idx}`,
        title: `${reportTypes[idx % reportTypes.length].replace('_', ' ')} - ${new Date().toLocaleDateString()}`,
        type: reportTypes[idx % reportTypes.length],
        generatedBy: 'System',
        generatedAt: new Date(),
        format: ['pdf', 'csv', 'excel'][idx % 3],
        status: 'completed',
        parameters: { dateRange: 'last_30_days' },
        data: { summary: 'Report data placeholder', recordCount: 10 + idx * 5 },
      });
    });

    const reports = await Promise.all(reportPromises);
    console.log(`Seeded ${reports.length} reports`);

    // Seed Audit Logs
    const auditActions = ['LOGIN', 'PERSON_CREATE', 'CASE_CREATE', 'FINGERPRINT_SCAN', 'FACE_MATCH', 'WATCHLIST_ADD', 'REPORT_GENERATE'];
    const auditPromises = Array(15).fill(null).map(async (_, idx) => {
      return AuditLog.create({
        userId: `user_${idx % 3 + 1}`,
        userName: ['Admin', 'Officer Smith', 'Officer Johnson'][idx % 3],
        action: auditActions[idx % auditActions.length],
        targetType: ['person', 'case', 'report', 'system'][idx % 4],
        targetId: `target_${idx}`,
        targetName: `Target Item ${idx + 1}`,
        description: `${auditActions[idx % auditActions.length]} action performed`,
        ipAddress: `192.168.1.${100 + idx}`,
        userAgent: 'Biofugitive Mobile App',
        timestamp: new Date(Date.now() - idx * 3600000), // Spread over hours
      });
    });

    const audits = await Promise.all(auditPromises);
    console.log(`Seeded ${audits.length} audit logs`);

    res.status(200).json({
      message: "Database seeded successfully",
      counts: {
        persons: persons.length,
        cases: cases.length,
        reports: reports.length,
        auditLogs: audits.length,
      },
    });
  } catch (err) {
    console.error("Error seeding database:", err);
    res.status(500).json({ message: "Error seeding database", error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
