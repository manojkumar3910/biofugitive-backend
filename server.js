const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const User = require("./models/user");
const Main = require("./models/main");

dotenv.config();

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

// Login Route
app.post("/login", async (req, res) => {
  const { user_id, password } = req.body;
  
  // Check if password is numeric
  const isNumeric = /^\d+$/.test(password);
  const processedPassword = isNumeric ? Number(password) : password;
  
  console.log("Login attempt:", {
    user_id,
    password: processedPassword,
    passwordType: typeof processedPassword
  });

  try {
    const user = await User.findOne({ 
      user_id, 
      password: processedPassword 
    });
    console.log("Found user:", user);

    if (user) {
      res.status(200).json({ message: "Login successful" });
    } else {
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
