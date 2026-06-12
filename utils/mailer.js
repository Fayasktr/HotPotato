const nodemailer = require('nodemailer');
require('dotenv').config();

// If SMTP credentials are provided in .env, use them. 
// Otherwise, create a "mock" transporter that just logs the email to the terminal.
let transporter;

if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
} else if (process.env.MAIL_USER && process.env.MAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
} else {
  // Mock transporter for local development
  transporter = {
    sendMail: async (mailOptions) => {
      console.log('\n=============================================');
      console.log('📧 MOCK EMAIL SENT (No SMTP configured)');
      console.log(`To: ${mailOptions.to}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`\nMessage Body:\n${mailOptions.text || mailOptions.html}`);
      console.log('=============================================\n');
      return { messageId: 'mock-id-1234' };
    }
  };
}

module.exports = {
  sendMail: async (mailOptions) => {
    try {
      // Provide a default "from" address
      const options = {
        from: process.env.MAIL_FROM || '"Hot Potato Admin" <noreply@hotpotato.local>',
        ...mailOptions
      };
      const info = await transporter.sendMail(options);
      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }
};
