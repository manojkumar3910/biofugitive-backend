const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const Papa = require("papaparse");
const User = require("./models/user");
const Main = require("./models/main");

dotenv.config();

// CSV file path and image directory
const CSV_PATH = path.join(__dirname, "../biofugitive-app-frontend/public/person_dataset.csv");
const FINGERPRINT_DIR = "C:/manoj/projects/llb/fingerprint/SOCOFing/Real";

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
  const { user_id, password, email, name } = req.body;

  // Validate required fields
  if (!user_id || !password) {
    return res.status(400).json({ message: "User ID and password are required" });
  }

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
    });

    await newUser.save();
    console.log("New user created:", user_id);

    res.status(201).json({ message: "Signup successful" });
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

    // Compare passwords (handle both string and number comparisons)
    const storedPassword = String(user.password);
    const inputPassword = String(password);
    
    console.log("Comparing passwords:", { stored: storedPassword, input: inputPassword });

    if (storedPassword === inputPassword) {
      console.log("Login successful for:", user_id);
      res.status(200).json({ message: "Login successful" });
    } else {
      console.log("Password mismatch");
      res.status(401).json({ message: "Invalid credentials" });
    }
  } catch (err) {
    console.error("Login error:", err);
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

// Serve fingerprint images
app.get("/fingerprints/:filename", (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(FINGERPRINT_DIR, filename);

  // Security check - prevent directory traversal
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return res.status(400).json({ message: "Invalid filename" });
  }

  // Check if directory exists
  if (!fs.existsSync(FINGERPRINT_DIR)) {
    return res.status(500).json({ message: "Fingerprint directory not found" });
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "Image not found", requested: filename });
  }
  
  // Set content type for BMP images
  res.setHeader("Content-Type", "image/bmp");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.sendFile(filePath, (err) => {
    if (err) {
      console.log("ERROR sending file:", err.message);
    } else {
      console.log("File sent successfully:", filename);
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
