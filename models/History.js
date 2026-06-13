const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  fromId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  toId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromEmail: { type: String },
  toEmail: { type: String },
  reason: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('History', historySchema);
