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
    
    // History - last 3 entries
    const historyLog = await History.find({ batchId })
      .sort('-timestamp')
      .limit(3)
      .populate('fromId toId');

    // Leaderboard aggregation
    const leaderboard = await History.aggregate([
      { $match: { batchId: batch._id } },
      { $group: { _id: "$toId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 },
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

// GET /batch/:batchId/history -> full history log
router.get('/:batchId/history', isInBatch, async (req, res) => {
  try {
    const batchId = req.params.batchId;
    
    if (req.session.user.role !== 'admin' && req.session.user.batchId.toString() !== batchId) {
      req.flash('error', 'You can only view your own batch');
      return res.redirect('/');
    }

    const batch = await Batch.findById(batchId);
    
    // History - all entries
    const historyLog = await History.find({ batchId })
      .sort('-timestamp')
      .populate('fromId toId');

    res.render('batch/history', { batch, historyLog });
  } catch (err) {
    req.flash('error', 'Error loading history view');
    res.redirect(`/batch/${req.params.batchId}`);
  }
});

// GET /batch/:batchId/graph -> full leaderboard graph
router.get('/:batchId/graph', isInBatch, async (req, res) => {
  try {
    const batchId = req.params.batchId;
    
    if (req.session.user.role !== 'admin' && req.session.user.batchId.toString() !== batchId) {
      req.flash('error', 'You can only view your own batch');
      return res.redirect('/');
    }

    const batch = await Batch.findById(batchId);
    
    // Leaderboard aggregation (all members)
    const leaderboard = await History.aggregate([
      { $match: { batchId: batch._id } },
      { $group: { _id: "$toId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: "$user" },
      { $project: { name: "$user.name", count: 1 } }
    ]);

    res.render('batch/graph', { batch, leaderboard });
  } catch (err) {
    req.flash('error', 'Error loading graph view');
    res.redirect(`/batch/${req.params.batchId}`);
  }
});

// GET /batch/:batchId/all-members -> view all members without management
router.get('/:batchId/all-members', isInBatch, async (req, res) => {
  try {
    const batchId = req.params.batchId;
    
    if (req.session.user.role !== 'admin' && req.session.user.batchId.toString() !== batchId) {
      req.flash('error', 'You can only view your own batch');
      return res.redirect('/');
    }

    const batch = await Batch.findById(batchId);
    const members = await User.find({ batchId }).sort('name');
    const potato = await Potato.findOne({ batchId }).populate('holderId');

    res.render('batch/all-members', { batch, members, potato });
  } catch (err) {
    req.flash('error', 'Error loading members view');
    res.redirect(`/batch/${req.params.batchId}`);
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

function getKolkataActiveMinutes(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start >= end) return 0;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  
  const startParts = formatter.format(start).split(', ');
  const endParts = formatter.format(end).split(', ');
  
  const [sMonth, sDay, sYear] = startParts[0].split('/');
  const [sHour, sMin, sSec] = startParts[1].split(':');
  
  const [eMonth, eDay, eYear] = endParts[0].split('/');
  const [eHour, eMin, eSec] = endParts[1].split(':');

  const localStart = new Date(Date.UTC(sYear, sMonth - 1, sDay, sHour, sMin, sSec));
  const localEnd = new Date(Date.UTC(eYear, eMonth - 1, eDay, eHour, eMin, eSec));

  let totalMinutes = 0;
  let currentDay = new Date(Date.UTC(localStart.getUTCFullYear(), localStart.getUTCMonth(), localStart.getUTCDate()));
  const endDay = new Date(Date.UTC(localEnd.getUTCFullYear(), localEnd.getUTCMonth(), localEnd.getUTCDate()));

  while (currentDay <= endDay) {
    const dayOfWeek = currentDay.getUTCDay();
    
    if (dayOfWeek !== 0) { // Skip Sunday
      const activeStart = new Date(Date.UTC(currentDay.getUTCFullYear(), currentDay.getUTCMonth(), currentDay.getUTCDate(), 9, 0, 0));
      const activeEnd = new Date(Date.UTC(currentDay.getUTCFullYear(), currentDay.getUTCMonth(), currentDay.getUTCDate(), 22, 0, 0));

      let dayStart = localStart > activeStart ? localStart : activeStart;
      if (dayStart < activeStart || dayStart.getUTCDate() !== currentDay.getUTCDate()) {
        dayStart = activeStart;
      }

      let dayEnd = localEnd < activeEnd ? localEnd : activeEnd;
      if (dayEnd > activeEnd || dayEnd.getUTCDate() !== currentDay.getUTCDate()) {
        dayEnd = activeEnd;
      }

      if (dayStart < dayEnd && dayStart.getUTCDate() === currentDay.getUTCDate() && dayEnd.getUTCDate() === currentDay.getUTCDate()) {
        const diffMs = dayEnd - dayStart;
        totalMinutes += Math.floor(diffMs / 60000);
      }
    }

    currentDay.setUTCDate(currentDay.getUTCDate() + 1);
  }

  return totalMinutes;
}

// GET /batch/:batchId/duration -> render active duration leaderboard
router.get('/:batchId/duration', isInBatch, async (req, res) => {
  try {
    const batchId = req.params.batchId;
    
    if (req.session.user.role !== 'admin' && req.session.user.batchId.toString() !== batchId) {
      req.flash('error', 'You can only view your own batch');
      return res.redirect('/');
    }

    const batch = await Batch.findById(batchId);
    const potato = await Potato.findOne({ batchId });
    const members = await User.find({ batchId });
    const historyLog = await History.find({ batchId }).sort('timestamp');

    const durationMap = {};
    members.forEach(m => {
      durationMap[m._id.toString()] = 0;
    });

    let currentHolder = null;
    let lastEventTime = null;

    for (const h of historyLog) {
      if (currentHolder) {
        const holderIdStr = currentHolder.toString();
        const minutes = getKolkataActiveMinutes(lastEventTime, h.timestamp);
        if (durationMap[holderIdStr] !== undefined) {
          durationMap[holderIdStr] += minutes;
        } else {
          durationMap[holderIdStr] = minutes;
        }
      }
      currentHolder = h.toId;
      lastEventTime = h.timestamp;
    }

    // Add current holding time if potato is active and held
    if (potato && potato.holderId && currentHolder) {
      const holderIdStr = potato.holderId.toString();
      const minutes = getKolkataActiveMinutes(lastEventTime, new Date());
      if (durationMap[holderIdStr] !== undefined) {
        durationMap[holderIdStr] += minutes;
      } else {
        durationMap[holderIdStr] = minutes;
      }
    }

    const durationLeaderboard = members.map(m => {
      const totalMinutes = durationMap[m._id.toString()] || 0;
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      let durationStr = '';
      if (hours > 0) {
        durationStr += `${hours}h `;
      }
      durationStr += `${mins}m`;
      return {
        id: m._id,
        name: m.name,
        email: m.email,
        totalMinutes,
        durationStr
      };
    }).sort((a, b) => b.totalMinutes - a.totalMinutes);

    res.render('batch/duration', { batch, leaderboard: durationLeaderboard });
  } catch (err) {
    req.flash('error', 'Error loading duration leaderboard');
    res.redirect(`/batch/${req.params.batchId}`);
  }
});

module.exports = router;
