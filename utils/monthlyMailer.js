const mongoose = require('mongoose');
const mailer = require('./mailer');
const MonthlyConfirmation = require('../models/MonthlyConfirmation');

const checkAndSendMonthlyEmail = async () => {
  try {
    // Get current month in Asia/Kolkata (Kochi/India) timezone
    const getKolkataMonthString = () => {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit'
        });
        const [month, year] = formatter.format(new Date()).split('/');
        return `${year}-${month}`;
      } catch (e) {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
      }
    };

    const monthKey = getKolkataMonthString();

    // Check if we already sent confirmation for this month
    const existing = await MonthlyConfirmation.findOne({ monthKey });
    if (existing) {
      return;
    }

    console.log(`[Monthly Mailer] Sending monthly confirmation email for ${monthKey}...`);

    // Send the email to admin@gmail.com
    await mailer.sendMail({
      to: 'admin@gmail.com',
      subject: `Monthly Confirmation - Hot Potato (${monthKey})`,
      text: `Hello Admin,\n\nThis is your automated monthly confirmation email for Hot Potato. The system is running normally.\n\nDate key: ${monthKey}\n\nBest regards,\nHot Potato System`
    });

    // Save confirmation to DB
    await MonthlyConfirmation.create({ monthKey });
    console.log(`[Monthly Mailer] Monthly confirmation for ${monthKey} recorded successfully.`);
  } catch (error) {
    console.error('Error checking or sending monthly confirmation email:', error);
  }
};

module.exports = {
  checkAndSendMonthlyEmail
};
