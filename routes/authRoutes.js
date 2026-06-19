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
    
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.05); color: #333333; border: 1px solid #eaeaea;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2b3a4a; margin: 0; font-size: 32px; letter-spacing: -0.5px;">🥔 Hot Potato</h1>
          <p style="color: #88929b; font-size: 16px; margin-top: 8px;">Password Reset Request</p>
        </div>
        <div style="background: #f9fbfd; padding: 30px; border-radius: 8px; border-left: 5px solid #4a90e2;">
          <p style="font-size: 18px; font-weight: 600; margin-top: 0; color: #2b3a4a;">Hello ${user.name},</p>
          <p style="font-size: 16px; line-height: 1.6; color: #4a5568;">We received a request to reset the password for your Hot Potato account. If you didn't make this request, you can safely ignore this email.</p>
          <div style="text-align: center; margin: 40px 0;">
            <a href="${resetLink}" style="background-color: #4a90e2; color: #ffffff; text-decoration: none; padding: 15px 35px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 14px rgba(74, 144, 226, 0.4); transition: background-color 0.3s ease;">Reset My Password</a>
          </div>
          <p style="font-size: 14px; color: #718096; margin-bottom: 0;">Or copy and paste this link into your browser:<br>
          <a href="${resetLink}" style="color: #4a90e2; word-break: break-all; margin-top: 8px; display: inline-block;">${resetLink}</a></p>
        </div>
        <div style="text-align: center; margin-top: 40px; font-size: 14px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 20px;">
          <p>&copy; ${new Date().getFullYear()} Hot Potato App. All rights reserved.</p>
        </div>
      </div>
    `;

    await mailer.sendMail({
      to: user.email,
      subject: 'Password Reset - Hot Potato',
      text: `Hello ${user.name},\n\nWe received a request to reset your Hot Potato password.\nClick the link below to reset your password:\n${resetLink}\n\nIf you did not request this, please ignore this email.`,
      html: htmlContent
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
    req.flash('error', 'New password and confirm password do not match');
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
