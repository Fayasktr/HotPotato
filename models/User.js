const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address.']
  },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'coordinator', 'admin'], default: 'student' },
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }
});

module.exports = mongoose.model('User', userSchema);
