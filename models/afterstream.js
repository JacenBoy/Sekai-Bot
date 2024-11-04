const mongoose = require("mongoose");

const afterstreamSchema = new mongoose.Schema({
  message: String,
  resolved: Boolean
});

module.exports = mongoose.model("Afterstream", afterstreamSchema);