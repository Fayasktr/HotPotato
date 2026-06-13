const nodemailer = require('nodemailer');
require('dotenv').config();
const EmailCounter = require('../models/EmailCounter');

let transporter;
let useBrevoAPI = false;

if (process.env.BREVO_API_KEY) {
  useBrevoAPI = true;
} else if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    family: 4, // Force IPv4 to avoid ENETUNREACH on cloud environments
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
} else if (process.env.MAIL_USER && process.env.MAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    family: 4, // Force IPv4 to avoid ENETUNREACH on systems with broken IPv6 routing
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
} else {
  // Mock transporter for local development
  transporter = {
    sendMail: async (mailOptions) => {
      console.log('\n=============================================');
      console.log('📧 MOCK EMAIL SENT (No SMTP/API configured)');
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
    // 1. Get current date in Asia/Kolkata (Kochi/India) timezone
    const getKolkataDateString = () => {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const [month, day, year] = formatter.format(new Date()).split('/');
        return `${year}-${month}-${day}`;
      } catch (e) {
        return new Date().toISOString().split('T')[0];
      }
    };

    const dateStr = getKolkataDateString();

    // 2. Enforce Daily Limit (max 200 emails/day)
    try {
      const counter = await EmailCounter.findOne({ date: dateStr });
      if (counter && counter.count >= 200) {
        const limitErr = new Error('Daily email limit (200) reached. Email blocked.');
        console.error(limitErr.message);
        throw limitErr;
      }
    } catch (dbErr) {
      if (dbErr.message.includes('Limit reached') || dbErr.message.includes('blocked')) {
        throw dbErr;
      }
      console.error('Error checking daily email limit in DB:', dbErr);
    }

    const fromAddress = process.env.MAIL_FROM || 'noreply@hotpotato.local';
    
    if (useBrevoAPI) {
      // Send using Brevo HTTP API (Port 443 HTTPS - never blocked by Render Free)
      try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            sender: { 
              name: process.env.MAIL_SENDER_NAME || 'Hot Potato Admin', 
              email: fromAddress 
            },
            to: [{ email: mailOptions.to }],
            subject: mailOptions.subject,
            textContent: mailOptions.text,
            htmlContent: mailOptions.html || undefined
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(`Brevo API returned status ${response.status}: ${JSON.stringify(errData)}`);
        }

        const info = await response.json();
        
        // Increment daily counter on successful send
        await EmailCounter.findOneAndUpdate(
          { date: dateStr },
          { $inc: { count: 1 } },
          { upsert: true }
        ).catch(e => console.error('Error incrementing email counter:', e));

        return { messageId: info.messageId || 'brevo-api-sent' };
      } catch (error) {
        console.error('Error sending email via Brevo API:', error);
        throw error;
      }
    } else {
      // Send using Nodemailer SMTP transporter
      try {
        const options = {
          from: `"${process.env.MAIL_SENDER_NAME || 'Hot Potato Admin'}" <${fromAddress}>`,
          ...mailOptions
        };
        const info = await transporter.sendMail(options);
        
        // Increment daily counter on successful send
        await EmailCounter.findOneAndUpdate(
          { date: dateStr },
          { $inc: { count: 1 } },
          { upsert: true }
        ).catch(e => console.error('Error incrementing email counter:', e));

        return info;
      } catch (error) {
        console.error('Error sending email:', error);
        throw error;
      }
    }
  }
};
