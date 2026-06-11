const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Batch = require('../models/Batch');
const PasswordReset = require('../models/PasswordReset');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const mailer = require('../utils/mailer');

// --- Login ---
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/login');
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/login');
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/login');
    }
    
    req.session.user = user;
    req.flash('success', 'Logged in successfully');
    res.redirect('/');
  } catch (err) {
    req.flash('error', 'Something went wrong');
    res.redirect('/login');
  }
});

// --- Register ---
router.get('/register', async (req, res) => {
  if (req.session.user) return res.redirect('/');
  const batchId = req.query.batchId || '';
  try {
    const batches = await Batch.find().sort('name');
    res.render('auth/register', { batches, batchId });
  } catch (err) {
    res.redirect('/');
  }
});

router.post('/register', async (req, res) => {
  const { name, email, password, batchId } = req.body;
  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      req.flash('error', 'Email already in use');
      return res.redirect('/register');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'student', // Defaults to student
      batchId: batchId || null
    });
    
    await user.save();
    req.flash('success', 'Registered successfully, please log in');
    res.redirect('/login');
  } catch (err) {
    req.flash('error', 'Error registering user');
    res.redirect('/register');
  }
});

// --- Forgot Password ---
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password');
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      req.flash('success', 'If that email exists, a reset link has been sent.');
      return res.redirect('/forgot-password');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 3600000; // 1 hour

    await PasswordReset.create({ userId: user._id, token, expiresAt });

    const resetLink = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
    await mailer.sendMail({
      to: user.email,
      subject: 'Password Reset - Hot Potato',
      text: `Click the link to reset your password: ${resetLink}`
    });

    req.flash('success', 'If that email exists, a reset link has been sent.');
    res.redirect('/forgot-password');
  } catch (err) {
    req.flash('error', 'Error processing request');
    res.redirect('/forgot-password');
  }
});

// --- Reset Password ---
router.get('/reset-password/:token', async (req, res) => {
  try {
    const reset = await PasswordReset.findOne({ token: req.params.token, expiresAt: { $gt: Date.now() } });
    if (!reset) {
      req.flash('error', 'Invalid or expired token');
      return res.redirect('/forgot-password');
    }
    res.render('auth/reset-password', { token: req.params.token });
  } catch (err) {
    res.redirect('/forgot-password');
  }
});

router.post('/reset-password/:token', async (req, res) => {
  const { password, confirmPassword } = req.body;
  if (password !== confirmPassword) {
    req.flash('error', 'Passwords do not match');
    return res.redirect(`/reset-password/${req.params.token}`);
  }

  try {
    const reset = await PasswordReset.findOne({ token: req.params.token, expiresAt: { $gt: Date.now() } });
    if (!reset) {
      req.flash('error', 'Invalid or expired token');
      return res.redirect('/forgot-password');
    }

    const user = await User.findById(reset.userId);
    user.password = await bcrypt.hash(password, 10);
    await user.save();

    await PasswordReset.deleteMany({ userId: user._id }); // Clear out used tokens

    req.flash('success', 'Password reset successfully, please log in');
    res.redirect('/login');
  } catch (err) {
    req.flash('error', 'Error resetting password');
    res.redirect('/forgot-password');
  }
});

// --- Logout ---
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
