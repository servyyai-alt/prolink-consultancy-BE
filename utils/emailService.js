const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async ({ to, subject, html, text }) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  };
  return transporter.sendMail(mailOptions);
};

const sendInBackground = (task, label = 'Email task') => {
  setImmediate(async () => {
    try {
      await task();
    } catch (error) {
      console.error(`${label} failed:`, error.message);
    }
  });
};

// Email templates
const emailTemplates = {
  otp: (otp, name) => ({
    subject: 'Verify Your Email - ProLink Consultancy',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 40px;">
        <div style="background: #1a56db; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">ProLink Consultancy</h1>
        </div>
        <div style="background: white; padding: 40px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #333;">Hello ${name}! 👋</h2>
          <p style="color: #666; font-size: 16px;">Use this OTP to verify your email address. Valid for 10 minutes.</p>
          <div style="background: #f0f4ff; border: 2px dashed #1a56db; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 36px; font-weight: bold; color: #1a56db; letter-spacing: 8px;">${otp}</span>
          </div>
          <p style="color: #999; font-size: 14px;">If you didn't request this, please ignore this email.</p>
        </div>
      </div>
    `,
  }),

  welcomeEmail: (name) => ({
    subject: 'Welcome to ProLink Consultancy! 🎉',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 40px;">
        <div style="background: #1a56db; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">ProLink Consultancy</h1>
        </div>
        <div style="background: white; padding: 40px; border-radius: 0 0 8px 8px;">
          <h2>Welcome, ${name}! 🎊</h2>
          <p style="color: #666;">Thank you for joining ProLink Consultancy. We are excited to help you find your dream job or the perfect candidate.</p>
          <a href="${process.env.CLIENT_URL}/jobs" style="background: #1a56db; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 20px 0;">Browse Jobs →</a>
          <p style="color: #999; font-size: 14px;">Best regards,<br>The ProLink Team</p>
        </div>
      </div>
    `,
  }),

  passwordReset: (resetLink, name) => ({
    subject: 'Password Reset Request - ProLink Consultancy',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 40px;">
        <div style="background: #1a56db; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">ProLink Consultancy</h1>
        </div>
        <div style="background: white; padding: 40px; border-radius: 0 0 8px 8px;">
          <h2>Hello ${name},</h2>
          <p style="color: #666;">You requested a password reset. Click the button below to reset your password. This link expires in 30 minutes.</p>
          <a href="${resetLink}" style="background: #1a56db; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 20px 0;">Reset Password</a>
          <p style="color: #999; font-size: 14px;">If you didn't request this, please ignore this email.</p>
        </div>
      </div>
    `,
  }),

  applicationReceived: (applicantName, jobTitle) => ({
    subject: `Application Received: ${jobTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px;">
        <h2 style="color: #1a56db;">Application Confirmed ✅</h2>
        <p>Hi ${applicantName},</p>
        <p>Your application for <strong>${jobTitle}</strong> has been received successfully. We'll review it and get back to you shortly.</p>
        <p>Track your applications in your <a href="${process.env.CLIENT_URL}/dashboard/applications">dashboard</a>.</p>
        <p>Best of luck!<br>The ProLink Team</p>
      </div>
    `,
  }),
};

const sendTemplateEmail = async (to, template, ...args) => {
  const { subject, html } = emailTemplates[template](...args);
  return sendEmail({ to, subject, html });
};

module.exports = { sendEmail, sendInBackground, sendTemplateEmail, emailTemplates };
