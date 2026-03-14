const nodemailer = require('nodemailer');
const config = require('../config/env');

/**
 * Email Service - handles sending emails via nodemailer
 */

// Create transporter
let transporter = null;
let transporterVerified = false;

const initializeTransporter = () => {
  if (!transporter) {
    console.log('📧 Initializing email transporter with:', {
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      user: config.email.user ? `${config.email.user.substring(0, 5)}...` : 'NOT SET',
      password: config.email.password ? '***SET***' : 'NOT SET'
    });
    
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure, // false for port 587, true for 465
      auth: {
        user: config.email.user,
        pass: config.email.password
      },
      tls: {
        // Do not fail on invalid certs
        rejectUnauthorized: false
      }
    });
  }
  return transporter;
};

// Verify transporter connection (async)
const verifyTransporter = async () => {
  if (!transporterVerified && transporter) {
    try {
      await transporter.verify();
      console.log('✅ Email transporter verified successfully');
      transporterVerified = true;
    } catch (verifyError) {
      console.error('❌ Email transporter verification failed:', verifyError.message);
      transporterVerified = false;
    }
  }
};

/**
 * Send email with optional attachments
 */
const sendEmail = async ({ to, subject, html, text, attachments = [] }) => {
  try {
    // Validate email configuration
    if (!config.email.user || !config.email.password) {
      const errorMsg = 'Email configuration is missing. Please set EMAIL_USER and EMAIL_PASSWORD in your .env file.';
      console.error(`❌ ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // Check if credentials are still placeholders
    const placeholderPatterns = [
      'yourname', 'your_email', 'example', 'test@example',
      'your_gmail_app_password', 'abcdefghijklmnop', 'password', 'changeme'
    ];
    
    const isPlaceholderUser = placeholderPatterns.some(pattern => 
      config.email.user.toLowerCase().includes(pattern.toLowerCase())
    );
    const isPlaceholderPassword = placeholderPatterns.some(pattern => 
      config.email.password.toLowerCase().includes(pattern.toLowerCase())
    ) || config.email.password.length < 16; // App passwords are 16 chars
    
    if (isPlaceholderUser || isPlaceholderPassword) {
      const errorMsg = `Email credentials appear to be placeholders. 
        Current EMAIL_USER: ${config.email.user}
        Please set real Gmail credentials in your .env file:
        1. EMAIL_USER=your_actual_email@gmail.com
        2. EMAIL_PASSWORD=your_16_character_app_password
        Get App Password at: https://myaccount.google.com/apppasswords`;
      console.error(`❌ ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    const transport = initializeTransporter();
    
    // Verify connection on first use
    await verifyTransporter();
    
    const mailOptions = {
      from: config.email.from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
      attachments
    };

    const result = await transport.sendMail(mailOptions);
    console.log(`📧 Email sent successfully to ${to}: ${result.messageId}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    
    // Provide helpful error messages
    let errorMessage = error.message;
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please check your EMAIL_USER and EMAIL_PASSWORD in .env file. Make sure you\'re using a Gmail App Password, not your regular password.';
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Could not connect to email server. Please check your EMAIL_HOST and EMAIL_PORT settings.';
    }
    
    return { success: false, error: errorMessage };
  }
};

/**
 * Send OTP verification email
 */
const sendOTPEmail = async (email, otp, name) => {
  const subject = 'Verify Your Email - Appointment Booking';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">📅 Appointment Booking</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">Hello ${name || 'there'}! 👋</h2>
                  <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                    Thank you for registering! Please use the verification code below to verify your email address.
                  </p>
                  
                  <!-- OTP Box -->
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
                    <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px;">Your Verification Code</p>
                    <h1 style="color: #ffffff; font-size: 48px; letter-spacing: 12px; margin: 0; font-family: 'Courier New', monospace;">${otp}</h1>
                  </div>
                  
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                    ⏰ This code will expire in <strong>${config.otp.expiresIn} minutes</strong>.
                  </p>
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 10px 0 0 0;">
                    If you didn't request this code, please ignore this email.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 16px 16px; text-align: center;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} Appointment Booking. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
};

/**
 * Send cancellation OTP email
 */
const sendCancellationOTPEmail = async (email, otp, name, appointmentTitle, refundAmount) => {
  const subject = 'Confirm Booking Cancellation - OTP Verification';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cancellation OTP</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <div style="background: rgba(255,255,255,0.2); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 40px;">⚠️</span>
                  </div>
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Confirm Cancellation</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">Hello ${name || 'there'}!</h2>
                  <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    You've requested to cancel your appointment: <strong>${appointmentTitle || 'Appointment'}</strong>
                  </p>
                  
                  <!-- Refund Info -->
                  ${refundAmount > 0 ? `
                  <div style="background: #ecfdf5; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #10b981;">
                    <p style="color: #065f46; font-size: 14px; margin: 0 0 10px 0;">💰 Refund Amount (90%)</p>
                    <p style="color: #065f46; font-size: 28px; font-weight: 700; margin: 0;">₹${refundAmount.toFixed(2)}</p>
                  </div>
                  ` : ''}
                  
                  <!-- OTP Box -->
                  <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
                    <p style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px;">Your Cancellation OTP</p>
                    <h1 style="color: #ffffff; font-size: 48px; letter-spacing: 12px; margin: 0; font-family: 'Courier New', monospace;">${otp}</h1>
                  </div>
                  
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                    ⏰ This code will expire in <strong>${config.otp.expiresIn} minutes</strong>.
                  </p>
                  <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 10px 0 0 0;">
                    If you didn't request this cancellation, please ignore this email or contact support.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 16px 16px; text-align: center;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} Appointment Booking. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({ to: email, subject, html });
};

/**
 * Send booking confirmation email with calendar invite
 */
const sendBookingConfirmationEmail = async (booking, calendarContent) => {
  const customerEmail = booking.isGuestBooking 
    ? booking.guestInfo?.email 
    : booking.customerId?.email;
  
  const customerName = booking.isGuestBooking 
    ? booking.guestInfo?.name 
    : booking.customerId?.name;

  if (!customerEmail) {
    console.error('❌ No customer email for booking confirmation');
    return { success: false, error: 'No customer email' };
  }

  const appointmentTitle = booking.appointmentTypeId?.title || 'Appointment';
  const providerName = booking.providerId?.name || 'Provider';
  const startTime = new Date(booking.startTime);
  const endTime = new Date(booking.endTime);
  
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
  
  const formattedDate = startTime.toLocaleDateString('en-US', dateOptions);
  const formattedStartTime = startTime.toLocaleTimeString('en-US', timeOptions);
  const formattedEndTime = endTime.toLocaleTimeString('en-US', timeOptions);

  const subject = `Booking Confirmed: ${appointmentTitle} with ${providerName}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <div style="background: rgba(255,255,255,0.2); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 40px;">✅</span>
                  </div>
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Booking Confirmed!</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 22px;">Hello ${customerName}! 👋</h2>
                  <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                    Your appointment has been successfully booked. Here are the details:
                  </p>
                  
                  <!-- Appointment Details Card -->
                  <div style="background: #f9fafb; border-radius: 12px; padding: 25px; margin: 20px 0; border-left: 4px solid #10b981;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">📋 Service</span>
                          <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 4px 0 0 0;">${appointmentTitle}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">👤 Provider</span>
                          <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 4px 0 0 0;">${providerName}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">📅 Date</span>
                          <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 4px 0 0 0;">${formattedDate}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">🕐 Time</span>
                          <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 4px 0 0 0;">${formattedStartTime} - ${formattedEndTime}</p>
                        </td>
                      </tr>
                      ${booking.appointmentTypeId?.price > 0 ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">💰 Amount</span>
                          <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 4px 0 0 0;">₹${booking.appointmentTypeId.price}</p>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </div>
                  
                  <!-- Calendar Invite Note -->
                  <div style="background: #eff6ff; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                    <p style="color: #1e40af; font-size: 14px; margin: 0;">
                      📎 <strong>Calendar invite attached!</strong><br>
                      <span style="color: #3b82f6;">Open the .ics file to add this appointment to your calendar.</span>
                    </p>
                  </div>
                  
                  ${booking.providerId?.contactEmail ? `
                  <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                    📧 Need to reach out? Contact: <a href="mailto:${booking.providerId.contactEmail}" style="color: #667eea;">${booking.providerId.contactEmail}</a>
                  </p>
                  ` : ''}
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 16px 16px; text-align: center;">
                  <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                    Thank you for choosing us!
                  </p>
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} Appointment Booking. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const attachments = calendarContent ? [{
    filename: 'appointment.ics',
    content: calendarContent,
    contentType: 'text/calendar; charset=utf-8; method=REQUEST'
  }] : [];

  return sendEmail({ to: customerEmail, subject, html, attachments });
};

/**
 * Send booking cancellation email
 */
const sendBookingCancellationEmail = async (booking, cancelledByName) => {
  const customerEmail = booking.isGuestBooking 
    ? booking.guestInfo?.email 
    : booking.customerId?.email;
  
  const customerName = booking.isGuestBooking 
    ? booking.guestInfo?.name 
    : booking.customerId?.name;

  if (!customerEmail) {
    return { success: false, error: 'No customer email' };
  }

  const appointmentTitle = booking.appointmentTypeId?.title || 'Appointment';
  const providerName = booking.providerId?.name || 'Provider';
  const startTime = new Date(booking.startTime);
  const refundAmount = booking.refundAmount || 0;
  const hasRefund = refundAmount > 0;
  
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
  
  const formattedDate = startTime.toLocaleDateString('en-US', dateOptions);
  const formattedTime = startTime.toLocaleTimeString('en-US', timeOptions);

  const subject = `Booking Cancelled: ${appointmentTitle}${hasRefund ? ' - Refund Processed' : ''}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Cancellation</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <div style="background: rgba(255,255,255,0.2); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 40px;">❌</span>
                  </div>
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Booking Cancelled</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 22px;">Hello ${customerName},</h2>
                  <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                    Your appointment has been cancelled${cancelledByName ? ` by ${cancelledByName}` : ''}. Here are the details:
                  </p>
                  
                  <!-- Cancelled Appointment Details -->
                  <div style="background: #fef2f2; border-radius: 12px; padding: 25px; margin: 20px 0; border-left: 4px solid #ef4444;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">📋 Service</span>
                          <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 4px 0 0 0;">${appointmentTitle}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">📅 Was scheduled for</span>
                          <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 4px 0 0 0;">${formattedDate} at ${formattedTime}</p>
                        </td>
                      </tr>
                      ${booking.cancellationReason ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">📝 Reason</span>
                          <p style="color: #1f2937; font-size: 16px; margin: 4px 0 0 0;">${booking.cancellationReason}</p>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </div>
                  
                  ${hasRefund ? `
                  <!-- Refund Information -->
                  <div style="background: #ecfdf5; border-radius: 12px; padding: 25px; margin: 20px 0; border-left: 4px solid #10b981;">
                    <div style="display: flex; align-items: center; margin-bottom: 15px;">
                      <span style="font-size: 24px; margin-right: 10px;">💰</span>
                      <h3 style="color: #065f46; margin: 0; font-size: 18px;">Refund Processed</h3>
                    </div>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Refund Amount</span>
                          <p style="color: #065f46; font-size: 24px; font-weight: 700; margin: 4px 0 0 0;">₹${refundAmount.toFixed(2)}</p>
                        </td>
                      </tr>
                    </table>
                    <p style="color: #047857; font-size: 13px; margin: 15px 0 0 0;">
                      Your refund will be credited to your original payment method within 5-10 business days.
                    </p>
                  </div>
                  ` : ''}
                  
                  <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                    We're sorry for any inconvenience. Feel free to book another appointment at your convenience.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 16px 16px; text-align: center;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} Appointment Booking. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({ to: customerEmail, subject, html });
};

/**
 * Send booking reschedule email
 */
const sendBookingRescheduleEmail = async (booking, oldStartTime) => {
  const customerEmail = booking.isGuestBooking 
    ? booking.guestInfo?.email 
    : booking.customerId?.email;
  
  const customerName = booking.isGuestBooking 
    ? booking.guestInfo?.name 
    : booking.customerId?.name;

  if (!customerEmail) {
    return { success: false, error: 'No customer email' };
  }

  const appointmentTitle = booking.appointmentTypeId?.title || 'Appointment';
  const providerName = booking.providerId?.name || 'Provider';
  const newStartDate = new Date(booking.startTime);
  const oldStartDate = new Date(oldStartTime);
  
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
  
  const newFormattedDate = newStartDate.toLocaleDateString('en-US', dateOptions);
  const newFormattedTime = newStartDate.toLocaleTimeString('en-US', timeOptions);
  const oldFormattedDate = oldStartDate.toLocaleDateString('en-US', dateOptions);
  const oldFormattedTime = oldStartDate.toLocaleTimeString('en-US', timeOptions);

  const subject = `Appointment Rescheduled: ${appointmentTitle}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Appointment Rescheduled</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <div style="background: rgba(255,255,255,0.2); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 40px;">🔄</span>
                  </div>
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Appointment Rescheduled</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 22px;">Hello ${customerName},</h2>
                  <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                    Your appointment has been rescheduled. Please note the new time below:
                  </p>
                  
                  <!-- Old Time (Crossed out) -->
                  <div style="background: #fef2f2; border-radius: 12px; padding: 20px; margin: 20px 0; opacity: 0.7;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">❌ Previous Time</p>
                    <p style="color: #9ca3af; font-size: 16px; text-decoration: line-through; margin: 0;">
                      ${oldFormattedDate} at ${oldFormattedTime}
                    </p>
                  </div>
                  
                  <!-- New Time -->
                  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; padding: 25px; margin: 20px 0;">
                    <p style="color: rgba(255,255,255,0.9); font-size: 12px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">✅ New Time</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: rgba(255,255,255,0.8); font-size: 14px;">📋 Service</span>
                          <p style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 4px 0 0 0;">${appointmentTitle}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: rgba(255,255,255,0.8); font-size: 14px;">📅 Date</span>
                          <p style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 4px 0 0 0;">${newFormattedDate}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: rgba(255,255,255,0.8); font-size: 14px;">🕐 Time</span>
                          <p style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 4px 0 0 0;">${newFormattedTime}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: rgba(255,255,255,0.8); font-size: 14px;">👤 Provider</span>
                          <p style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 4px 0 0 0;">${providerName}</p>
                        </td>
                      </tr>
                    </table>
                  </div>
                  
                  ${booking.rescheduleReason ? `
                  <div style="background: #f3f4f6; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0;">
                      <strong>Reason:</strong> ${booking.rescheduleReason}
                    </p>
                  </div>
                  ` : ''}
                  
                  <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                    Please update your calendar with the new time. If you have any questions, feel free to contact ${providerName}.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 16px 16px; text-align: center;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} Appointment Booking. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({ to: customerEmail, subject, html });
};

/**
 * Send provider notification about new booking
 */
const sendProviderBookingNotification = async (booking) => {
  const providerEmail = booking.providerId?.contactEmail;
  
  if (!providerEmail) {
    return { success: false, error: 'No provider email' };
  }

  const customerName = booking.isGuestBooking 
    ? booking.guestInfo?.name 
    : booking.customerId?.name;
  
  const customerEmail = booking.isGuestBooking 
    ? booking.guestInfo?.email 
    : booking.customerId?.email;

  const appointmentTitle = booking.appointmentTypeId?.title || 'Appointment';
  const startTime = new Date(booking.startTime);
  const endTime = new Date(booking.endTime);
  
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
  
  const formattedDate = startTime.toLocaleDateString('en-US', dateOptions);
  const formattedStartTime = startTime.toLocaleTimeString('en-US', timeOptions);
  const formattedEndTime = endTime.toLocaleTimeString('en-US', timeOptions);

  const subject = `New Booking: ${appointmentTitle} - ${customerName}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Booking Notification</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center;">
                  <div style="background: rgba(255,255,255,0.2); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 40px;">📅</span>
                  </div>
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">New Booking!</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                    You have a new appointment booking. Here are the details:
                  </p>
                  
                  <!-- Booking Details Card -->
                  <div style="background: #eff6ff; border-radius: 12px; padding: 25px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">📋 Service</span>
                          <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 4px 0 0 0;">${appointmentTitle}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">👤 Customer</span>
                          <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 4px 0 0 0;">${customerName}${booking.isGuestBooking ? ' (Guest)' : ''}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">📧 Email</span>
                          <p style="color: #1f2937; font-size: 16px; margin: 4px 0 0 0;"><a href="mailto:${customerEmail}" style="color: #3b82f6;">${customerEmail}</a></p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">📅 Date</span>
                          <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 4px 0 0 0;">${formattedDate}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">🕐 Time</span>
                          <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 4px 0 0 0;">${formattedStartTime} - ${formattedEndTime}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">📌 Status</span>
                          <p style="color: #1f2937; font-size: 16px; font-weight: 600; margin: 4px 0 0 0;">
                            <span style="background: ${booking.status === 'CONFIRMED' ? '#dcfce7' : '#fef3c7'}; color: ${booking.status === 'CONFIRMED' ? '#166534' : '#92400e'}; padding: 4px 12px; border-radius: 20px; font-size: 14px;">
                              ${booking.status}
                            </span>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 16px 16px; text-align: center;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    © ${new Date().getFullYear()} Appointment Booking. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({ to: providerEmail, subject, html });
};

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendCancellationOTPEmail,
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
  sendBookingRescheduleEmail,
  sendProviderBookingNotification
};
