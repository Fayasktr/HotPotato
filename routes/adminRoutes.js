const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Batch = require('../models/Batch');
const Potato = require('../models/Potato');
const History = require('../models/History');
const { isLoggedIn, isAdmin } = require('../middleware/authMiddleware');

const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'admin@test.com').toLowerCase();

router.use(isLoggedIn);
router.use(isAdmin);

// GET /admin -> render admin/dashboard.ejs
router.get('/', async (req, res) => {
  try {
    const batches = await Batch.find().populate('coordinatorId');
    const users = await User.find();
    const activeHolders = await Potato.countDocuments({ holderId: { $ne: null } });
    res.render('admin/dashboard', { batches, users, activeHolders });
  } catch (err) {
    req.flash('error', 'Error loading dashboard');
    res.redirect('/');
  }
});

// GET /admin/batches -> render admin/batches.ejs
router.get('/batches', async (req, res) => {
  try {
    const batches = await Batch.find().populate('createdBy').populate('coordinatorId');
    const coordinators = await User.find({ role: { $in: ['coordinator', 'admin'] } });
    res.render('admin/batches', { batches, coordinators });
  } catch (err) {
    req.flash('error', 'Error loading batches');
    res.redirect('/admin');
  }
});

// POST /admin/batches -> create Batch and Potato doc
router.post('/batches', async (req, res) => {
  try {
    const { name, coordinatorId } = req.body;
    const batch = await Batch.create({ 
      name, 
      createdBy: req.session.user._id,
      coordinatorId: coordinatorId || null 
    });
    
    // Also update the coordinator's batchId to match this new batch
    if (coordinatorId) {
      await User.findByIdAndUpdate(coordinatorId, { batchId: batch._id });
    }
    
    await Potato.create({ batchId: batch._id, holderId: null });
    req.flash('success', 'Batch created successfully');
    res.redirect('/admin/batches');
  } catch (err) {
    req.flash('error', 'Error creating batch');
    res.redirect('/admin/batches');
  }
});

// DELETE /admin/batches/:id -> delete batch and potato doc
router.delete('/batches/:id', async (req, res) => {
  try {
    await Batch.findByIdAndDelete(req.params.id);
    await Potato.findOneAndDelete({ batchId: req.params.id });
    
    // EDGE CASE FIX: Unset batchId for all users in this batch
    await User.updateMany({ batchId: req.params.id }, { batchId: null });
    
    // EDGE CASE FIX: Delete history logs for this batch to prevent dangling user references
    await History.deleteMany({ batchId: req.params.id });
    
    req.flash('success', 'Batch and its history deleted');
    res.redirect('/admin/batches');
  } catch (err) {
    req.flash('error', 'Error deleting batch');
    res.redirect('/admin/batches');
  }
});

// GET /admin/users -> render admin/users.ejs
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().populate('batchId');
    const batches = await Batch.find();

    // Sort by batch name, then user name
    users.sort((a, b) => {
      const batchA = a.batchId ? a.batchId.name.toLowerCase() : 'zzzzz';
      const batchB = b.batchId ? b.batchId.name.toLowerCase() : 'zzzzz';
      if (batchA < batchB) return -1;
      if (batchA > batchB) return 1;
      return a.name.localeCompare(b.name);
    });

    res.render('admin/users', { users, batches });
  } catch (err) {
    req.flash('error', 'Error loading users');
    res.redirect('/admin');
  }
});

// POST /admin/users -> create new user
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, role, batchId } = req.body;
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      req.flash('error', 'Email already in use');
      return res.redirect('/admin/users');
    }
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || 'coordinator',
      batchId: batchId || null
    });

    if (user.role === 'coordinator' && user.batchId) {
      await Batch.findByIdAndUpdate(user.batchId, { coordinatorId: user._id });
    }

    req.flash('success', 'User created successfully');
    res.redirect('/admin/users');
  } catch (err) {
    req.flash('error', 'Error creating user');
    res.redirect('/admin/users');
  }
});

// POST /admin/users/:id/role -> change user role
router.post('/users/:id/role', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.redirect('/admin/users');

    // Protect primary owner
    if (user.email === OWNER_EMAIL) {
      req.flash('error', 'The primary owner cannot be modified.');
      return res.redirect('/admin/users');
    }

    const { role } = req.body;

    // If setting as coordinator, update Batch.coordinatorId
    if (role === 'coordinator' && user.batchId) {
      await Batch.findByIdAndUpdate(user.batchId, { coordinatorId: user._id });
    }

    // If removing coordinator role, check if they were the coordinator and remove it
    if (user.role === 'coordinator' && role !== 'coordinator' && user.batchId) {
      const batch = await Batch.findById(user.batchId);
      if (batch && batch.coordinatorId && batch.coordinatorId.toString() === user._id.toString()) {
        batch.coordinatorId = null;
        await batch.save();
      }
    }

    user.role = role;
    await user.save();

    req.flash('success', 'User role updated');
    res.redirect('/admin/users');
  } catch (err) {
    req.flash('error', 'Error updating role');
    res.redirect('/admin/users');
  }
});

// POST /admin/users/:id/batch -> reassign user to a different batch
router.post('/users/:id/batch', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.redirect('/admin/users');

    if (user.email === OWNER_EMAIL) {
      req.flash('error', 'The primary owner cannot be assigned to a batch.');
      return res.redirect('/admin/users');
    }

    const { batchId } = req.body;
    
    // If the user is a coordinator, handle updating the Batch documents
    if (user.role === 'coordinator' || user.role === 'admin') {
      // 1. Remove them from their old batch if they were the coordinator
      if (user.batchId) {
        const oldBatch = await Batch.findById(user.batchId);
        if (oldBatch && oldBatch.coordinatorId && oldBatch.coordinatorId.toString() === user._id.toString()) {
          oldBatch.coordinatorId = null;
          await oldBatch.save();
        }
      }
      // 2. Add them as the coordinator to their new batch
      if (batchId) {
        await Batch.findByIdAndUpdate(batchId, { coordinatorId: user._id });
      }
    }

    await User.findByIdAndUpdate(req.params.id, { batchId: batchId || null });
    req.flash('success', 'User batch reassigned');
    res.redirect('/admin/users');
  } catch (err) {
    req.flash('error', 'Error reassigning batch');
    res.redirect('/admin/users');
  }
});

// DELETE /admin/users/:id -> delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.redirect('/admin/users');

    if (user.email === OWNER_EMAIL) {
      req.flash('error', 'The primary owner cannot be deleted.');
      return res.redirect('/admin/users');
    }

    // EDGE CASE FIX: If they are the coordinator of any batch, unset it
    if (user.role === 'coordinator' || user.role === 'admin') {
      await Batch.updateMany({ coordinatorId: user._id }, { coordinatorId: null });
    }

    // EDGE CASE FIX: If they are holding a potato, drop it so the game doesn't break
    await Potato.updateMany({ holderId: user._id }, { holderId: null, reason: 'User was removed from the system' });

    await User.findByIdAndDelete(req.params.id);
    req.flash('success', 'User deleted');
    res.redirect('/admin/users');
  } catch (err) {
    req.flash('error', 'Error deleting user');
    res.redirect('/admin/users');
  }
});

// POST /admin/potato/:batchId/reset -> force reset potato state
router.post('/potato/:batchId/reset', async (req, res) => {
  try {
    await Potato.findOneAndUpdate(
      { batchId: req.params.batchId },
      { holderId: null, reason: '', taggedBy: null },
      { upsert: true }
    );
    req.flash('success', 'Potato has been reset for this batch');
    res.redirect(`/batch/${req.params.batchId}`);
  } catch (err) {
    req.flash('error', 'Error resetting potato');
    res.redirect('/admin/batches');
  }
});

module.exports = router;
