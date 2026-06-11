const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');

// GET / -> landing page or redirect to dashboard
router.get('/', async (req, res) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'admin') {
      return res.redirect('/admin');
    } else if (req.session.user.batchId) {
      return res.redirect(`/batch/${req.session.user.batchId}`);
    }
  }

  try {
    const batches = await Batch.find().sort('name');
    res.render('index', { batches });
  } catch (err) {
    console.error('Error loading landing page', err);
    res.send('An error occurred');
  }
});

module.exports = router;
