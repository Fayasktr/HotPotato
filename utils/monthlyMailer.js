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

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.05); color: #333333; border: 1px solid #eaeaea;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2b3a4a; margin: 0; font-size: 32px; letter-spacing: -0.5px;">🥔 Hot Potato</h1>
          <p style="color: #88929b; font-size: 16px; margin-top: 8px;">System Status Report</p>
        </div>
        <div style="background: #f9fbfd; padding: 30px; border-radius: 8px; border-left: 5px solid #2ecc71;">
          <p style="font-size: 18px; font-weight: 600; margin-top: 0; color: #2b3a4a;">Hello Admin,</p>
          <p style="font-size: 16px; line-height: 1.6; color: #4a5568;">This is your automated monthly confirmation email for Hot Potato. The system is up and running normally.</p>
          
          <div style="background: #ffffff; padding: 15px; border-radius: 6px; margin: 25px 0; border: 1px solid #e2e8f0; text-align: center;">
            <span style="display: block; font-size: 12px; color: #a0aec0; text-transform: uppercase; font-weight: 600; letter-spacing: 1px; margin-bottom: 5px;">Report Cycle</span>
            <span style="font-size: 20px; font-weight: 700; color: #2d3748;">${monthKey}</span>
          </div>
          
          <p style="font-size: 15px; color: #718096; margin-bottom: 0;">Everything looks good! No action is required on your part.</p>
        </div>
        <div style="text-align: center; margin-top: 40px; font-size: 14px; color: #a0aec0; border-top: 1px solid #edf2f7; padding-top: 20px;">
          <p>&copy; ${new Date().getFullYear()} Hot Potato App. All rights reserved.</p>
        </div>
      </div>
    `;

    // Send the email to admin@gmail.com
    await mailer.sendMail({
      to: 'admin@gmail.com',
      subject: `Monthly Confirmation - Hot Potato (${monthKey})`,
      text: `Hello Admin,\n\nThis is your automated monthly confirmation email for Hot Potato. The system is running normally.\n\nDate key: ${monthKey}\n\nBest regards,\nHot Potato System`,
      html: htmlContent
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
