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
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@test.com',
      password: adminPassword,
      role: 'admin'
    });
    console.log('Admin created');

    // 2. Create Batches
    const batch1 = await Batch.create({ name: 'BCE312', createdBy: admin._id });
    const batch2 = await Batch.create({ name: 'BCE317', createdBy: admin._id });
    console.log('Batches created');

    // 3. Create Coordinator for BCE312
    const coordPassword = await bcrypt.hash('pass123', 10);
    const coordinator = await User.create({
      name: 'Fayas',
      email: 'fayas@test.com',
      password: coordPassword,
      role: 'coordinator',
      batchId: batch1._id
    });
    batch1.coordinatorId = coordinator._id;
    await batch1.save();
    console.log('Coordinator created');

    // 4. Create Students for BCE312
    const studentPassword = await bcrypt.hash('student123', 10);
    for (let i = 1; i <= 3; i++) {
      await User.create({
        name: `Student 312-${i}`,
        email: `student312-${i}@test.com`,
        password: studentPassword,
        role: 'student',
        batchId: batch1._id
      });
    }

    // 5. Create Students for BCE317
    for (let i = 1; i <= 2; i++) {
      await User.create({
        name: `Student 317-${i}`,
        email: `student317-${i}@test.com`,
        password: studentPassword,
        role: 'student',
        batchId: batch2._id
      });
    }
    console.log('Students created');

    // 6. Create Potato docs for batches
    await Potato.create({ batchId: batch1._id, holderId: null });
    await Potato.create({ batchId: batch2._id, holderId: null });
    console.log('Potato docs created');

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDB();
