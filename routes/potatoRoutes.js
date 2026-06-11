const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Batch = require('../models/Batch');
const Potato = require('../models/Potato');
const History = require('../models/History');
const { isLoggedIn } = require('../middleware/authMiddleware');

router.use(isLoggedIn);

// POST /potato/assign -> assign first holder
router.post('/assign', async (req, res) => {
  const { batchId, toId, reason } = req.body;
  try {
    const user = req.session.user;
    
    // Validate role
    if (user.role === 'student') {
      req.flash('error', 'Students cannot assign the initial potato');
      return res.redirect(`/batch/${batchId}`);
    }
    
    if (user.role === 'coordinator' && user.batchId.toString() !== batchId) {
      req.flash('error', 'You can only assign in your own batch');
      return res.redirect(`/batch/${batchId}`);
    }

    // Validate potato is null
    const potato = await Potato.findOne({ batchId });
    if (!potato || potato.holderId) {
      req.flash('error', 'Potato is already held or missing');
      return res.redirect(`/batch/${batchId}`);
    }

    // Validate toId is in batch
    const toUser = await User.findOne({ _id: toId, batchId });
    if (!toUser) {
      req.flash('error', 'Invalid target user');
      return res.redirect(`/batch/${batchId}`);
    }

    // Validate reason length (min 5 words)
    const wordCount = reason.trim().split(/\s+/).length;
    if (wordCount < 5) {
      req.flash('error', 'Reason must be at least 5 words');
      return res.redirect(`/batch/${batchId}`);
    }

    // Assign potato
    potato.holderId = toId;
    potato.reason = reason;
    potato.taggedBy = user._id;
    potato.timestamp = Date.now();
    await potato.save();

    // Create history
    await History.create({
      batchId,
      fromId: user._id,
      toId,
      reason
    });

    req.flash('success', 'Potato assigned successfully');
    res.redirect(`/batch/${batchId}`);
  } catch (err) {
    req.flash('error', 'Error assigning potato');
    res.redirect(`/batch/${batchId}`);
  }
});

// POST /potato/pass -> pass potato
router.post('/pass', async (req, res) => {
  const { batchId, toId, reason } = req.body;
  try {
    const user = req.session.user;

    const potato = await Potato.findOne({ batchId });
    if (!potato || !potato.holderId) {
      req.flash('error', 'No one currently holds the potato');
      return res.redirect(`/batch/${batchId}`);
    }

    // Validate role permissions
    let allowed = false;
    if (user.role === 'admin') {
      allowed = true;
    } else if (user.role === 'coordinator' && user.batchId.toString() === batchId) {
      allowed = true;
    } else if (user.role === 'student' && user._id.toString() === potato.holderId.toString()) {
      allowed = true;
    }

    if (!allowed) {
      req.flash('error', 'You do not have permission to pass this potato');
      return res.redirect(`/batch/${batchId}`);
    }

    // Validate target
    if (toId.toString() === potato.holderId.toString()) {
      req.flash('error', 'Cannot pass the potato to the current holder');
      return res.redirect(`/batch/${batchId}`);
    }

    const toUser = await User.findOne({ _id: toId, batchId });
    if (!toUser) {
      req.flash('error', 'Invalid target user');
      return res.redirect(`/batch/${batchId}`);
    }

    // Validate reason
    const wordCount = reason.trim().split(/\s+/).length;
    if (wordCount < 5) {
      req.flash('error', 'Reason must be at least 5 words');
      return res.redirect(`/batch/${batchId}`);
    }

    // Pass potato
    const fromId = potato.holderId; // capture the person who is losing it
    
    potato.holderId = toId;
    potato.reason = reason;
    potato.taggedBy = user._id; // The one performing the action (might be admin overriding)
    potato.timestamp = Date.now();
    await potato.save();

    // Create history
    await History.create({
      batchId,
      fromId: user._id, // Recording the actor who passed it
      toId,
      reason
    });

    req.flash('success', 'Potato passed successfully');
    res.redirect(`/batch/${batchId}`);
  } catch (err) {
    req.flash('error', 'Error passing potato');
    res.redirect(`/batch/${batchId}`);
  }
});

module.exports = router;
