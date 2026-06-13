const mongoose = require('mongoose');

const monthlyConfirmationSchema = new mongoose.Schema({
  monthKey: { type: String, required: true, unique: true } // Format: YYYY-MM
});

module.exports = mongoose.model('MonthlyConfirmation', monthlyConfirmationSchema);
