const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  user_id: String,
  password: mongoose.Schema.Types.Mixed, // Accept both string and number
});

module.exports = mongoose.model("User", userSchema, "login"); // 'login' is collection name
