const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

const fixEmails = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hotpotato');
    console.log('Connected to DB');
    
    const users = await User.find({});
    let count = 0;
    for (let u of users) {
      if (u.email !== u.email.toLowerCase()) {
        u.email = u.email.toLowerCase();
        await u.save();
        count++;
      }
    }
    console.log(`Updated ${count} users to lowercase emails.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

fixEmails();
