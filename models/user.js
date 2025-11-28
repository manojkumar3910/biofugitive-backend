const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  user_id: { type: String, required: true, unique: true },
  password: { type: mongoose.Schema.Types.Mixed, required: true }, // Accept both string and number
  email: { type: String, default: null },
  name: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema, "login"); // 'login' is collection name
