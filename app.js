require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hotpotato')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Setup express
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Setup method-override
app.use(methodOverride('_method'));

// Setup session
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false
}));

// Setup connect-flash
app.use(flash());

// Global middleware
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.ownerEmail = (process.env.OWNER_EMAIL || 'admin@test.com').toLowerCase();
    next();
});

// Mount routes
app.use('/', require('./routes/index'));
app.use('/', require('./routes/authRoutes'));
app.use('/admin', require('./routes/adminRoutes'));
app.use('/batch', require('./routes/batchRoutes'));
app.use('/potato', require('./routes/potatoRoutes'));
app.use('/profile', require('./routes/profileRoutes'));

// 404 handler
app.use((req, res) => {
    res.status(404).send('Page not found');
});

// Listen on PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
