const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Batch = require('./models/Batch');
const Potato = require('./models/Potato');

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hotpotato');
        console.log('Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await Batch.deleteMany({});
        await Potato.deleteMany({});

        // 1. Create Admin
        const ownerEmail = process.env.OWNER_EMAIL;
        const ownerPass = process.env.OWNER_PASS;
        const adminPassword = await bcrypt.hash(ownerPass, 10);
        const admin = await User.create({
            name: 'Owner Admin',
            email: ownerEmail.toLowerCase(),
            password: adminPassword,
            role: 'admin'
        });
        console.log('Admin created');


        console.log('Database seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
};

seedDB();
