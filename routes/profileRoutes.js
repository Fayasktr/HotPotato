const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Batch = require('../models/Batch');
const bcrypt = require('bcryptjs');
const { isLoggedIn } = require('../middleware/authMiddleware');

// Apply isLoggedIn to all routes in this file
router.use(isLoggedIn);

// GET /profile -> render profile/index.ejs
router.get('/', async (req, res) => {
  try {
    let batchName = null;
    if (req.session.user.batchId) {
      const batch = await Batch.findById(req.session.user.batchId);
      if (batch) {
        batchName = batch.name;
      }
    }
    res.render('profile/index', { batchName });
  } catch (err) {
    req.flash('error', 'Error loading profile');
    res.redirect('/');
  }
});

// POST /profile/password -> change password
router.post('/password', async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  
  if (newPassword !== confirmPassword) {
    req.flash('error', 'New passwords do not match');
    return res.redirect('/profile');
  }

  try {
    const user = await User.findById(req.session.user._id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      req.flash('error', 'Incorrect current password');
      return res.redirect('/profile');
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    
    req.flash('success', 'Password changed successfully');
    res.redirect('/profile');
  } catch (err) {
    req.flash('error', 'Error changing password');
    res.redirect('/profile');
  }
});

module.exports = router;
