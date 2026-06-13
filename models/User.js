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

userSchema.post('save', async function(doc, next) {
  try {
    const History = mongoose.model('History');
    // Link any existing history logs matching this email to this user's new _id
    await History.updateMany(
      { toEmail: doc.email.toLowerCase() },
      { toId: doc._id }
    );
    await History.updateMany(
      { fromEmail: doc.email.toLowerCase() },
      { fromId: doc._id }
    );
  } catch (err) {
    console.error('Error auto-linking history logs to user:', err);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
