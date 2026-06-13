require('dotenv').config();
process.env.TZ = 'Asia/Kolkata';
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');

const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hotpotato')
    .then(async () => {
        console.log('Connected to MongoDB');
        
        // --- SECURE OWNER BOOTSTRAP ---
        // Since Render Free Tier does not have Shell access, we MUST create the 
        // initial owner automatically. This only runs once when the DB is empty.
        const User = require('./models/User');
        const adminCount = await User.countDocuments({ role: 'admin' });
        
        if (adminCount === 0 && process.env.OWNER_EMAIL && process.env.OWNER_PASS) {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(process.env.OWNER_PASS, 10);
            await User.create({
                name: 'Owner Admin',
                email: process.env.OWNER_EMAIL.toLowerCase(),
                password: hashedPassword,
                role: 'admin'
            });
            console.log(`Successfully bootstrapped owner account!`);
        }

        // --- MONTHLY EMAIL CONFIRMATION CHECK ---
        const { checkAndSendMonthlyEmail } = require('./utils/monthlyMailer');
        // Check immediately on startup
        checkAndSendMonthlyEmail();
        // Check every 12 hours
        setInterval(checkAndSendMonthlyEmail, 12 * 60 * 60 * 1000);
    })
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
    res.locals.formatDateTime = (date) => {
        if (!date) return '';
        try {
            return new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Kolkata',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }).format(new Date(date));
        } catch (e) {
            return '';
        }
    };
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
