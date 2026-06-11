const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Batch = require('../models/Batch');
const Potato = require('../models/Potato');
const History = require('../models/History');
const bcrypt = require('bcryptjs');
const { isLoggedIn, isInBatch } = require('../middleware/authMiddleware');

router.use(isLoggedIn);

// API endpoint for polling
router.get('/api/potato/:batchId', async (req, res) => {
  try {
    const potato = await Potato.findOne({ batchId: req.params.batchId }).populate('holderId taggedBy');
    if (!potato) return res.json(null);
    res.json({
      holderId: potato.holderId ? potato.holderId._id : null,
      holderName: potato.holderId ? potato.holderId.name : null,
      reason: potato.reason,
      taggedBy: potato.taggedBy ? potato.taggedBy.name : null,
      timestamp: potato.timestamp
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /batch/:batchId -> render main batch view
router.get('/:batchId', isInBatch, async (req, res) => {
  try {
    const batchId = req.params.batchId;
    
    // Validate user is in this batch or is admin
    if (req.session.user.role !== 'admin' && req.session.user.batchId.toString() !== batchId) {
      req.flash('error', 'You can only view your own batch');
      return res.redirect('/');
    }

    const batch = await Batch.findById(batchId).populate('coordinatorId');
    const potato = await Potato.findOne({ batchId }).populate('holderId taggedBy');
    const members = await User.find({ batchId }).sort('name');
    
    // History - last 30 entries
    const historyLog = await History.find({ batchId })
      .sort('-timestamp')
      .limit(30)
      .populate('fromId toId');

    // Leaderboard aggregation
    const leaderboard = await History.aggregate([
      { $match: { batchId: batch._id } },
      { $group: { _id: "$toId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: "$user" },
      { $project: { name: "$user.name", count: 1 } }
    ]);

    res.render('batch/view', { batch, potato, members, historyLog, leaderboard });
  } catch (err) {
    req.flash('error', 'Error loading batch view');
    res.redirect('/');
  }
});

// GET /batch/:batchId/members -> member management
router.get('/:batchId/members', isInBatch, async (req, res) => {
  try {
    const batchId = req.params.batchId;
    const batch = await Batch.findById(batchId);
    
    // Check permission: must be admin OR coordinator of THIS batch
    const isCoordinatorOfThisBatch = req.session.user.role === 'coordinator' && batch.coordinatorId && batch.coordinatorId.toString() === req.session.user._id.toString();
    const isAdmin = req.session.user.role === 'admin';
    
    if (!isCoordinatorOfThisBatch && !isAdmin) {
      req.flash('error', 'You do not have permission to manage members');
      return res.redirect(`/batch/${batchId}`);
    }

    const members = await User.find({ batchId }).sort('name');
    res.render('batch/members', { batch, members });
  } catch (err) {
    req.flash('error', 'Error loading members view');
    res.redirect(`/batch/${req.params.batchId}`);
  }
});

// POST /batch/:batchId/members/add -> add a new student
router.post('/:batchId/members/add', isInBatch, async (req, res) => {
  try {
    const batchId = req.params.batchId;
    const batch = await Batch.findById(batchId);
    
    const isCoordinatorOfThisBatch = req.session.user.role === 'coordinator' && batch.coordinatorId && batch.coordinatorId.toString() === req.session.user._id.toString();
    const isAdmin = req.session.user.role === 'admin';
    
    if (!isCoordinatorOfThisBatch && !isAdmin) {
      req.flash('error', 'You do not have permission to add members');
      return res.redirect(`/batch/${batchId}`);
    }

    const { name, email, tempPassword } = req.body;
    
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      req.flash('error', 'Email already in use');
      return res.redirect(`/batch/${batchId}/members`);
    }

    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'student',
      batchId
    });

    req.flash('success', `Student added. Temp password is: ${tempPassword}`);
    res.redirect(`/batch/${batchId}/members`);
  } catch (err) {
    req.flash('error', 'Error adding member');
    res.redirect(`/batch/${req.params.batchId}/members`);
  }
});

module.exports = router;
