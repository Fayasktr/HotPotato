const mongoose = require('mongoose');

const potatoSchema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true, unique: true },
  holderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: { type: String },
  taggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date }
});

module.exports = mongoose.model('Potato', potatoSchema);
