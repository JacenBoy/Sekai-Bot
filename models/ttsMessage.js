const mongoose = require("mongoose");

const ttsMessageSchema = new mongoose.Schema({
  username: String,
  message: String,
  timestamp: String,
  read: Boolean
});

module.exports = mongoose.model("TtsMessage", ttsMessageSchema);
