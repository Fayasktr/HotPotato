const mongoose = require('mongoose');

const emailCounterSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // Format: YYYY-MM-DD
  count: { type: Number, default: 0 }
});

module.exports = mongoose.model('EmailCounter', emailCounterSchema);
