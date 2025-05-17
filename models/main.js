const mongoose = require("mongoose");

const mainSchema = new mongoose.Schema({}, { strict: false });

module.exports = mongoose.model("Main", mainSchema, "main");
