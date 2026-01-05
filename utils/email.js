const nodemailer = require('nodemailer');

class Email {
  constructor(user, url = '') {
    this.to = user.email;
    this.firstName = user.fullName.split(' ')[0];
    this.url = url;
    this.from = `Blood Donation System <${process.env.EMAIL_FROM}>`;
  }

  // Create transporter for Gmail
  newTransport() {
    // Gmail configuration
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  // Send the actual email
  async send(template, subject) {
    try {
      const mailOptions = {
        from: this.from,
        to: this.to,
        subject: subject,
        html: template,
        text: template.replace(/<[^>]*>/g, '') // Fallback text version
      };

      console.log('Attempting to send email to:', this.to);
      console.log('Using email service:', process.env.EMAIL_HOST);
      
      const transporter = this.newTransport();
      const result = await transporter.sendMail(mailOptions);
      
      console.log('Email sent successfully! Message ID:', result.messageId);
      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  // Send welcome email with verification link
  async sendWelcome() {
    const template = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: 'Arial', 'Helvetica', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f9f9f9;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #ffffff;
          }
          .header { 
            background: linear-gradient(to right, #dc2626, #b91c1c); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
            border-radius: 10px 10px 0 0; 
          }
          .content { 
            background: #f9fafb; 
            padding: 30px; 
            border-radius: 0 0 10px 10px; 
            border: 1px solid #e5e7eb; 
          }
          .button { 
            display: inline-block; 
            padding: 14px 28px; 
            background: #dc2626; 
            color: white; 
            text-decoration: none; 
            border-radius: 8px; 
            margin: 20px 0; 
            font-weight: bold;
            font-size: 16px;
          }
          .button:hover {
            background: #b91c1c;
          }
          .footer { 
            text-align: center; 
            margin-top: 30px; 
            font-size: 12px; 
            color: #6b7280; 
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          .verification-code {
            background: #f3f4f6;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            text-align: center;
            font-family: monospace;
            font-size: 18px;
            word-break: break-all;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">♥ Welcome to Blood Donor Network</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Start your journey to save lives</p>
          </div>
          <div class="content">
            <h2 style="color: #1f2937; margin-bottom: 20px;">Dear ${this.firstName},</h2>
            
            <p style="margin-bottom: 15px;">Welcome to the Blood Donor Network! Your account has been created and you're now ready to participate in this noble work of saving lives.</p>
            
            <p style="margin-bottom: 20px; font-weight: bold; color: #dc2626;">Click the button below to verify your email address:</p>
            
            <div style="text-align: center;">
              <a href="${this.url}" class="button">Verify Email</a>
            </div>

            <p style="margin: 20px 0; font-size: 14px; color: #6b7280;">
              Or copy and paste this link in your browser:<br>
              <div class="verification-code">${this.url}</div>
            </p>

            <div style="background: #dbeafe; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #1e40af; margin: 0 0 10px 0;">🚨 Important Information:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #374151;">
                <li>This link is valid for <strong>24 hours</strong></li>
                <li>You can log in only after email verification</li>
                <li>Don't forget to check your spam folder</li>
              </ul>
            </div>

            <p style="margin-bottom: 10px;">Thank you,</p>
            <p style="margin: 0; font-weight: bold; color: #dc2626;">Blood Donor Network Team</p>
          </div>
          <div class="footer">
            <p style="margin: 0;">© ${new Date().getFullYear()} Blood Donor Network. All rights reserved.</p>
            <p style="margin: 5px 0 0 0; font-size: 11px; color: #9ca3af;">
              This is an automated email. Please do not reply.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.send(template, 'Verify Your Email - Blood Donor Network');
  }

  // Send email verification
  async sendVerification() {
    const template = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: 'Arial', 'Helvetica', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f9f9f9;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #ffffff;
          }
          .header { 
            background: linear-gradient(to right, #dc2626, #b91c1c); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
            border-radius: 10px 10px 0 0; 
          }
          .content { 
            background: #f9fafb; 
            padding: 30px; 
            border-radius: 0 0 10px 10px; 
            border: 1px solid #e5e7eb; 
          }
          .button { 
            display: inline-block; 
            padding: 14px 28px; 
            background: #dc2626; 
            color: white; 
            text-decoration: none; 
            border-radius: 8px; 
            margin: 20px 0; 
            font-weight: bold;
            font-size: 16px;
          }
          .button:hover {
            background: #b91c1c;
          }
          .footer { 
            text-align: center; 
            margin-top: 30px; 
            font-size: 12px; 
            color: #6b7280; 
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          .verification-code {
            background: #f3f4f6;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            text-align: center;
            font-family: monospace;
            font-size: 16px;
            word-break: break-all;
            border: 1px dashed #d1d5db;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">Email Verification</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Activate Your Account</p>
          </div>
          <div class="content">
            <h2 style="color: #1f2937; margin-bottom: 20px;">Dear ${this.firstName},</h2>
            
            <p style="margin-bottom: 15px;">Click the button below to verify your email address:</p>
            
            <div style="text-align: center;">
              <a href="${this.url}" class="button">Verify Email</a>
            </div>

            <div style="background: #fffbeb; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; color: #92400e; font-weight: bold;">📌 If the button doesn't work:</p>
              <p style="margin: 10px 0 0 0; color: #92400e;">
                Copy and paste the URL below into your browser's address bar:
              </p>
              <div class="verification-code">${this.url}</div>
            </div>

            <div style="background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #0369a1; margin: 0 0 10px 0;">ℹ️ Information:</h3>
              <ul style="margin: 0; padding-left: 20px; color: #374151;">
                <li>This link is valid for <strong>24 hours</strong></li>
                <li>You can log in after verification</li>
                <li>You will be listed as a blood donor</li>
              </ul>
            </div>

            <p style="margin-bottom: 10px;">Thank you for your cooperation,</p>
            <p style="margin: 0; font-weight: bold; color: #dc2626;">Blood Donor Network</p>
          </div>
          <div class="footer">
            <p style="margin: 0;">© ${new Date().getFullYear()} Blood Donor Network. All rights reserved.</p>
            <p style="margin: 5px 0 0 0; font-size: 11px; color: #9ca3af;">
              If you didn't create this account, please ignore this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.send(template, 'Verify Your Email - Blood Donor Network');
  }

  // Send password reset email
  async sendPasswordReset() {
    const template = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: 'Arial', 'Helvetica', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f9f9f9;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #ffffff;
          }
          .header { 
            background: linear-gradient(to right, #dc2626, #b91c1c); 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
            border-radius: 10px 10px 0 0; 
          }
          .content { 
            background: #f9fafb; 
            padding: 30px; 
            border-radius: 0 0 10px 10px; 
            border: 1px solid #e5e7eb; 
          }
          .button { 
            display: inline-block; 
            padding: 14px 28px; 
            background: #dc2626; 
            color: white; 
            text-decoration: none; 
            border-radius: 8px; 
            margin: 20px 0; 
            font-weight: bold;
            font-size: 16px;
          }
          .button:hover {
            background: #b91c1c;
          }
          .footer { 
            text-align: center; 
            margin-top: 30px; 
            font-size: 12px; 
            color: #6b7280; 
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          .warning {
            background: #fef2f2;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            border-left: 4px solid #dc2626;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">Password Reset</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Secure Your Account</p>
          </div>
          <div class="content">
            <h2 style="color: #1f2937; margin-bottom: 20px;">Dear ${this.firstName},</h2>
            
            <p style="margin-bottom: 15px;">Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${this.url}" class="button">Reset Password</a>
            </div>

            <div class="warning">
              <p style="margin: 0; color: #dc2626; font-weight: bold;">⚠️ Important:</p>
              <p style="margin: 10px 0 0 0; color: #dc2626;">
                This link is valid for <strong>10 minutes</strong>. Please complete the process quickly.
              </p>
            </div>

            <p style="margin: 20px 0; color: #6b7280; font-size: 14px;">
              If you didn't request a password reset, please ignore this email. 
              Your account will remain secure.
            </p>

            <p style="margin-bottom: 10px;">Sincerely,</p>
            <p style="margin: 0; font-weight: bold; color: #dc2626;">Blood Donor Network Security Team</p>
          </div>
          <div class="footer">
            <p style="margin: 0;">© ${new Date().getFullYear()} Blood Donor Network. All rights reserved.</p>
            <p style="margin: 5px 0 0 0; font-size: 11px; color: #9ca3af;">
              This is an automated security email. Please do not reply.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.send(template, 'Reset Your Password - Blood Donor Network');
  }
}

module.exports = Email;